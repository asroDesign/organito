import { createHash, sign } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [version, outputArg, ...paths] = process.argv.slice(2);
const output = outputArg ? path.resolve(outputArg) : '';
const privateKeyPem = process.env.UPDATE_PRIVATE_KEY_PEM || (process.env.UPDATE_PRIVATE_KEY_FILE ? await readFile(process.env.UPDATE_PRIVATE_KEY_FILE, 'utf8') : '');

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || '') || !output || !paths.length || !privateKeyPem) {
  console.error('کاربرد: UPDATE_PRIVATE_KEY_FILE=/path/private.pem node scripts/create-update-package.mjs <version> <output.zip> <file> [file ...]');
  process.exit(2);
}

function allowed(name) {
  return name === 'package.json' || name === 'yarn.lock' || name === 'next.config.ts' || name.startsWith('src/') || name.startsWith('public/') || /^drizzle\/\d{4}_[a-zA-Z0-9_-]+\.sql$/.test(name);
}
function put16(buffer, at, value) { buffer.writeUInt16LE(value, at); }
function put32(buffer, at, value) { buffer.writeUInt32LE(value >>> 0, at); }
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
  return (crc ^ 0xffffffff) >>> 0;
}

const files = [];
for (const raw of [...new Set(paths)].sort()) {
  const name = raw.replace(/\\/g, '/');
  if (!allowed(name) || name.startsWith('/') || name.split('/').some((part) => !part || part === '..' || part.startsWith('.'))) throw new Error(`مسیر بسته مجاز نیست: ${name}`);
  const full = path.resolve(root, name);
  if (!full.startsWith(`${root}${path.sep}`)) throw new Error('فایل خارج از ریشه پروژه است');
  const st = await lstat(full);
  if (st.isSymbolicLink() || !st.isFile()) throw new Error(`فایل معمولی لازم است: ${name}`);
  const data = await readFile(full);
  if (data.length > 32 * 1024 * 1024) throw new Error(`فایل بزرگ‌تر از حد مجاز است: ${name}`);
  files.push({ path: name, size: data.length, sha256: createHash('sha256').update(data).digest('hex'), data });
}
const minimumVersion = process.env.UPDATE_MINIMUM_VERSION || '';
if (minimumVersion && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(minimumVersion)) throw new Error('UPDATE_MINIMUM_VERSION معتبر نیست');
const manifest = { product: 'organo-marketplace-shop', version, ...(minimumVersion ? { minimumVersion } : {}), createdAt: new Date().toISOString(), files: files.map(({ path, size, sha256 }) => ({ path, size, sha256 })) };
const manifestBytes = Buffer.from(JSON.stringify(manifest));
const signatureBytes = Buffer.from(`${sign(null, manifestBytes, privateKeyPem).toString('base64')}\n`);
const entries = [...files.map(({ path, data }) => ({ name: path, data })), { name: 'manifest.json', data: manifestBytes }, { name: 'manifest.sig', data: signatureBytes }];

const local = [], central = [];
let offset = 0;
for (const item of entries) {
  const name = Buffer.from(item.name, 'utf8'), data = item.data, crc = crc32(data);
  const header = Buffer.alloc(30);
  put32(header, 0, 0x04034b50); put16(header, 4, 20); put16(header, 6, 0x0800); put16(header, 8, 0); put16(header, 10, 0); put16(header, 12, 0);
  put32(header, 14, crc); put32(header, 18, data.length); put32(header, 22, data.length); put16(header, 26, name.length); put16(header, 28, 0);
  local.push(header, name, data);
  const record = Buffer.alloc(46);
  put32(record, 0, 0x02014b50); put16(record, 4, 20); put16(record, 6, 20); put16(record, 8, 0x0800); put16(record, 10, 0); put16(record, 12, 0); put16(record, 14, 0);
  put32(record, 16, crc); put32(record, 20, data.length); put32(record, 24, data.length); put16(record, 28, name.length); put16(record, 30, 0); put16(record, 32, 0); put16(record, 34, 0); put16(record, 36, 0); put32(record, 38, 0); put32(record, 42, offset);
  central.push(record, name);
  offset += header.length + name.length + data.length;
}
const centralBuffer = Buffer.concat(central), end = Buffer.alloc(22);
put32(end, 0, 0x06054b50); put16(end, 4, 0); put16(end, 6, 0); put16(end, 8, entries.length); put16(end, 10, entries.length); put32(end, 12, centralBuffer.length); put32(end, 16, offset); put16(end, 20, 0);
const zip = Buffer.concat([...local, centralBuffer, end]);
if (zip.length > 120 * 1024 * 1024) throw new Error('حجم بستهٔ خروجی از حد ۱۲۰ مگابایت بیشتر است');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, zip, { mode: 0o600, flag: 'wx' });
await chmod(output, 0o600);
console.log(`بستهٔ امضاشدهٔ ${version} ساخته شد: ${output}`);
