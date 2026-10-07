import { createHash, createPublicKey, verify } from "node:crypto";
import { inflateRawSync } from "node:zlib";

export const UPDATE_MAX_ARCHIVE = 120 * 1024 * 1024;
export const UPDATE_MAX_EXPANDED = 350 * 1024 * 1024;
export const UPDATE_MAX_FILE = 32 * 1024 * 1024;
export type UpdateManifest = {
  product: "organo-marketplace-shop";
  version: string;
  minimumVersion?: string;
  createdAt: string;
  files: Array<{ path: string; size: number; sha256: string }>;
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  return table;
})();

export function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function cleanPath(path: string) {
  if (!path || path.length > 240 || path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/.test(path)) return false;
  if (path === "manifest.json" || path === "manifest.sig") return true;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) return false;
  return path === "package.json" || path === "yarn.lock" || path === "next.config.ts" || path.startsWith("src/") || path.startsWith("public/") || /^drizzle\/\d{4}_[a-zA-Z0-9_-]+\.sql$/.test(path);
}

function safeMigration(data: Buffer) {
  const sql = data.toString("utf8");
  if (!sql.trim() || /\b(DROP|TRUNCATE|DELETE|UPDATE|RENAME|CASCADE|RESTART\s+IDENTITY)\b/i.test(sql)) return false;
  if (/ALTER\s+TABLE[\s\S]{0,200}\b(TYPE|COLUMN\s+[^;]+\s+TYPE)\b/i.test(sql)) return false;
  return /\b(CREATE|ALTER|INSERT|SELECT|COMMENT|GRANT|REVOKE)\b/i.test(sql);
}

function extractEntries(zip: Buffer) {
  if (zip.length > UPDATE_MAX_ARCHIVE) throw new Error("حجم فایل ZIP بیشتر از ۱۲۰ مگابایت است");
  let eocd = -1;
  for (let i = Math.max(0, zip.length - 65_557); i <= zip.length - 22; i++) if (zip.readUInt32LE(i) === 0x06054b50) eocd = i;
  if (eocd < 0) throw new Error("ساختار ZIP معتبر نیست");
  const disk = zip.readUInt16LE(eocd + 4), centralDisk = zip.readUInt16LE(eocd + 6);
  const count = zip.readUInt16LE(eocd + 10), centralSize = zip.readUInt32LE(eocd + 12), centralStart = zip.readUInt32LE(eocd + 16);
  if (disk || centralDisk || count > 2500 || centralStart + centralSize > eocd || count === 0xffff || centralSize === 0xffffffff) throw new Error("ZIP چندبخشی یا بیش از حد بزرگ پذیرفته نیست");
  const entries = new Map<string, Buffer>();
  let offset = centralStart, expanded = 0;
  for (let index = 0; index < count; index++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("فهرست داخلی ZIP خراب است");
    const flags = zip.readUInt16LE(offset + 8), method = zip.readUInt16LE(offset + 10), crc = zip.readUInt32LE(offset + 16);
    const compressedSize = zip.readUInt32LE(offset + 20), size = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28), extraLength = zip.readUInt16LE(offset + 30), commentLength = zip.readUInt16LE(offset + 32);
    const external = zip.readUInt32LE(offset + 38), localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;
    if (flags & 1 || flags & 0x40 || ![0, 8].includes(method) || size > UPDATE_MAX_FILE || !cleanPath(name)) throw new Error(`فایل غیرمجاز یا فشرده‌سازی پشتیبانی‌نشده: ${name}`);
    if (((external >>> 16) & 0xf000) === 0xa000) throw new Error("فایل‌های پیوندی در ZIP پذیرفته نیستند");
    if (entries.has(name)) throw new Error(`نام تکراری در ZIP: ${name}`);
    expanded += size;
    if (expanded > UPDATE_MAX_EXPANDED) throw new Error("حجم بازشدهٔ بسته بیش از حد مجاز است");
    if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("سرآیند فایل ZIP خراب است");
    const localNameLength = zip.readUInt16LE(localOffset + 26), localExtraLength = zip.readUInt16LE(localOffset + 28);
    const localName = zip.subarray(localOffset + 30, localOffset + 30 + localNameLength).toString("utf8");
    if (localName !== name) throw new Error("نام فایل در سرآیند ZIP با فهرست آن هم‌خوانی ندارد");
    const start = localOffset + 30 + localNameLength + localExtraLength, end = start + compressedSize;
    if (end > centralStart) throw new Error("محدودهٔ دادهٔ ZIP نامعتبر است");
    const compressed = zip.subarray(start, end);
    const content = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: UPDATE_MAX_FILE });
    if (content.length !== size || crc32(content) !== crc) throw new Error(`سلامت فایل ZIP تأیید نشد: ${name}`);
    entries.set(name, content);
  }
  return entries;
}

export function validateUpdateArchive(zip: Buffer, publicKeyPem: string) {
  const entries = extractEntries(zip);
  const manifestBytes = entries.get("manifest.json"), signatureText = entries.get("manifest.sig")?.toString("utf8").trim();
  if (!manifestBytes || !signatureText) throw new Error("manifest.json یا امضای بسته پیدا نشد");
  let manifest: UpdateManifest;
  try { manifest = JSON.parse(manifestBytes.toString("utf8")) as UpdateManifest; } catch { throw new Error("manifest.json معتبر نیست"); }
  if (manifest.product !== "organo-marketplace-shop" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version) || (manifest.minimumVersion !== undefined && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.minimumVersion)) || !Array.isArray(manifest.files) || manifest.files.length < 1 || manifest.files.length > 2500) throw new Error("مشخصات نسخه در manifest نامعتبر است");
  if (!Number.isFinite(Date.parse(manifest.createdAt))) throw new Error("تاریخ ساخت بسته نامعتبر است");
  const publicKey = createPublicKey(publicKeyPem.replace(/\\n/g, "\n"));
  if (!verify(null, manifestBytes, publicKey, Buffer.from(signatureText, "base64"))) throw new Error("امضای ناشر تأیید نشد؛ بسته قابل نصب نیست");
  const declared = new Set<string>();
  for (const file of manifest.files) {
    if (!cleanPath(file.path) || declared.has(file.path) || !Number.isInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error("فهرست فایل‌های بسته نامعتبر است");
    declared.add(file.path);
    const data = entries.get(file.path);
    if (!data || data.length !== file.size || createHash("sha256").update(data).digest("hex") !== file.sha256) throw new Error(`هش فایل با manifest هم‌خوانی ندارد: ${file.path}`);
    if (/^drizzle\//.test(file.path) && !safeMigration(data)) throw new Error(`migration حذف‌کننده یا ناسازگار پذیرفته نیست: ${file.path}`);
  }
  for (const name of entries.keys()) if (name !== "manifest.json" && name !== "manifest.sig" && !declared.has(name)) throw new Error(`فایل خارج از manifest پیدا شد: ${name}`);
  if (entries.size !== declared.size + 2) throw new Error("تعداد فایل‌های بسته با manifest هم‌خوانی ندارد");
  return { manifest, entries };
}
