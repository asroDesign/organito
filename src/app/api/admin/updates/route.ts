import { createPublicKey, randomUUID } from "node:crypto";
import { access, chmod, constants, mkdir, readFile, readdir, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn, execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { db } from "@/db";
import { audit } from "@/lib/audit";
import { sql } from "drizzle-orm";
import { validateUpdateArchive, UPDATE_MAX_ARCHIVE } from "@/lib/update-package";
import { HttpError } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateStatus = { id: string; state: "ready" | "applying" | "applied" | "failed"; version: string; createdAt: string; fileCount: number; migrationCount: number; message?: string; updatedAt: string };
const root = () => path.resolve(process.env.UPDATE_STORAGE_DIR || path.join(process.cwd(), "storage", "updates"));
const statusPath = (id: string) => path.join(root(), id, "status.json");
const publicKey = () => process.env.UPDATE_PUBLIC_KEY_PEM || "";
const execFile = promisify(execFileCallback);

type ReadinessCheck = { key: string; label: string; state: "ready" | "warning" | "blocked"; detail: string };
async function commandVersion(command: string, args: string[]) {
  try { const result = await execFile(command, args, { timeout: 2500, windowsHide: true }); return (result.stdout || result.stderr).trim().split("\n")[0].slice(0, 120); }
  catch { return null; }
}
async function readinessChecks(): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];
  const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
  const nodeSupported = nodeMajor > 20 || (nodeMajor === 20 && nodeMinor >= 9);
  checks.push({ key: "node", label: "نسخهٔ Node.js", state: nodeSupported ? "ready" : "blocked", detail: `Node.js ${process.versions.node}${!nodeSupported ? "؛ برای این مسیر به نسخهٔ ۲۰٫۹ یا بالاتر نیاز است" : ""}` });
  checks.push({ key: "environment", label: "محیط اجرا", state: process.env.NODE_ENV === "production" ? "ready" : "warning", detail: process.env.NODE_ENV === "production" ? "production" : "محیط فعلی production نیست؛ اجرای آپدیت غیرفعال می‌ماند" });
  let keyOk = false;
  try { if (publicKey()) keyOk = createPublicKey(publicKey().replace(/\\n/g, "\n")).asymmetricKeyType === "ed25519"; } catch { /* Invalid key is reported without exposing its value. */ }
  checks.push({ key: "signing-key", label: "کلید عمومی ناشر", state: keyOk ? "ready" : "blocked", detail: keyOk ? "کلید Ed25519 معتبر است" : "کلید Ed25519 معتبر روی سرور تنظیم نشده است" });
  checks.push({ key: "apply-enabled", label: "اجازهٔ اجرای پنلی", state: process.env.UPDATE_APPLY_ENABLED === "true" ? "ready" : "warning", detail: process.env.UPDATE_APPLY_ENABLED === "true" ? "فعال" : "برای جلوگیری از اجرای ناخواسته خاموش است" });
  try { await db.execute(sql`select 1`); checks.push({ key: "database", label: "اتصال پایگاه داده", state: "ready", detail: "اتصال و پاسخ پایگاه داده برقرار است" }); }
  catch { checks.push({ key: "database", label: "اتصال پایگاه داده", state: "blocked", detail: "اتصال پایگاه داده در دسترس نیست" }); }
  try {
    const disk = await statfs(root());
    const freeBytes = Number(disk.bavail) * Number(disk.bsize);
    await access(root(), constants.W_OK);
    checks.push({ key: "storage", label: "فضای دیسک به‌روزرسانی", state: freeBytes >= 1_000_000_000 ? "ready" : "warning", detail: `حدود ${Math.floor(freeBytes / 1_000_000_000)} گیگابایت فضای آزاد · پوشه قابل نوشتن است` });
  } catch { checks.push({ key: "storage", label: "فضای دیسک به‌روزرسانی", state: "blocked", detail: "پوشهٔ خصوصی به‌روزرسانی در دسترس یا قابل نوشتن نیست" }); }
  const [dumpVersion, pm2Version] = await Promise.all([commandVersion("pg_dump", ["--version"]), commandVersion("pm2", ["--version"])]);
  checks.push({ key: "pg-dump", label: "ابزار پشتیبان پایگاه داده", state: dumpVersion ? "ready" : "blocked", detail: dumpVersion || "pg_dump روی سرور پیدا نشد" });
  checks.push({ key: "pm2", label: "مدیر فرایند PM2", state: pm2Version ? "ready" : "blocked", detail: pm2Version ? `PM2 ${pm2Version}` : "PM2 روی سرور پیدا نشد" });
  return checks;
}

async function backupInventory() {
  const backupRoot = path.join(root(), "backups");
  try {
    const entries = await readdir(backupRoot, { withFileTypes: true });
    const rows = await Promise.all(entries.filter((entry) => entry.isDirectory() && /^[a-f0-9-]{36}$/.test(entry.name)).map(async (entry) => {
      const directory = path.join(backupRoot, entry.name);
      try {
        const [meta, dump, packageStatus] = await Promise.all([
          stat(directory), stat(path.join(directory, "database.dump")).catch(() => null), readStatus(entry.name),
        ]);
        return { id: entry.name, version: packageStatus?.version || "نامشخص", state: packageStatus?.state || "unknown", createdAt: meta.mtime.toISOString(), databaseBackup: !!dump && dump.size > 0, backupBytes: dump?.size || 0 };
      } catch { return null; }
    }));
    return rows.filter((row): row is NonNullable<typeof row> => !!row).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  } catch { return []; }
}

function sameOrigin(req: NextRequest) {
  if (req.headers.get("x-csrf") !== "1") throw new HttpError(403, "درخواست نامعتبر (CSRF)");
  const origin = req.headers.get("origin"), host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) throw new HttpError(403, "مبدأ درخواست نامعتبر است");
}
function compareVersions(left: string, right: string) {
  const parse = (value: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ?? ""] as const : null;
  };
  const a = parse(left), b = parse(right);
  if (!a || !b) throw new HttpError(400, "شمارهٔ نسخه برای مقایسه معتبر نیست");
  for (const i of [0, 1, 2] as const) if (a[i] !== b[i]) return a[i] - b[i];
  if (!a[3] && b[3]) return 1;
  if (a[3] && !b[3]) return -1;
  return a[3].localeCompare(b[3]);
}
async function currentVersion() {
  try { const saved = JSON.parse(await readFile(path.join(root(), "current-version.json"), "utf8")) as { version?: string }; if (saved.version) return saved.version; } catch { /* A new deployment has no updater release marker yet. */ }
  return process.env.APP_VERSION || "نامشخص";
}
async function ensureRoot() { await mkdir(root(), { recursive: true, mode: 0o700 }); await chmod(root(), 0o700); }
async function readStatus(id: string): Promise<UpdateStatus | null> {
  try { return JSON.parse(await readFile(statusPath(id), "utf8")) as UpdateStatus; } catch { return null; }
}
async function saveStatus(status: UpdateStatus) {
  const target = statusPath(status.id), temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(status), { mode: 0o600 }); await chmod(temp, 0o600); await rename(temp, target);
}
function respondError(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("admin update request failed", error);
  return NextResponse.json({ error: "درخواست به‌روزرسانی انجام نشد؛ ورودی یا دسترسی پوشهٔ به‌روزرسانی را بررسی کنید." }, { status: 500 });
}

export async function GET() {
  try {
    const user = await requireApi("SETTINGS_MANAGE");
    if (user.role !== "super_admin") throw new HttpError(403, "به‌روزرسانی فقط برای مدیر کل در دسترس است");
    await ensureRoot();
    const ids = (await readdir(root(), { withFileTypes: true })).filter((entry) => entry.isDirectory() && /^[a-f0-9-]{36}$/.test(entry.name)).map((entry) => entry.name);
    const packages = (await Promise.all(ids.map(readStatus))).filter((item): item is UpdateStatus => !!item).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const [checks, backups] = await Promise.all([readinessChecks(), backupInventory()]);
    const requiredChecks = new Set(["node", "environment", "signing-key", "apply-enabled", "database", "storage", "pg-dump", "pm2"]);
    const enabled = process.env.UPDATE_APPLY_ENABLED === "true" && process.env.NODE_ENV === "production" && checks.filter((check) => requiredChecks.has(check.key)).every((check) => check.state === "ready");
    return NextResponse.json({ packages, backups, checks, enabled, currentVersion: await currentVersion() });
  } catch (error) { return respondError(error); }
}

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = await requireApi("SETTINGS_MANAGE");
    if (user.role !== "super_admin") throw new HttpError(403, "به‌روزرسانی فقط برای مدیر کل در دسترس است");
    if (!publicKey()) throw new HttpError(503, "کلید عمومی امضای بسته در سرور تنظیم نشده است");
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (!contentLength) throw new HttpError(411, "برای کنترل اندازه، بارگذاری ZIP باید content-length داشته باشد؛ فایل را دوباره انتخاب کنید");
    if (contentLength > UPDATE_MAX_ARCHIVE + 1_000_000) throw new HttpError(413, "حجم بسته بیشتر از حد مجاز است");
    await ensureRoot();

    const type = req.headers.get("content-type") || "";
    if (type.includes("multipart/form-data")) {
      const form = await req.formData(), file = form.get("file");
      if (!file || typeof file !== "object" || !("arrayBuffer" in file) || !("name" in file) || !String(file.name).toLowerCase().endsWith(".zip")) throw new HttpError(400, "یک فایل ZIP معتبر انتخاب کنید");
      const uploadFile = file as File;
      if (uploadFile.size > UPDATE_MAX_ARCHIVE) throw new HttpError(413, "حجم فایل بیشتر از ۱۲۰ مگابایت است");
      let validated: ReturnType<typeof validateUpdateArchive>;
      try { validated = validateUpdateArchive(Buffer.from(await uploadFile.arrayBuffer()), publicKey()); }
      catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "اعتبارسنجی بسته ناموفق بود"); }
      const { manifest, entries } = validated;
      const installedVersion = await currentVersion();
      if (installedVersion !== "نامشخص" && compareVersions(manifest.version, installedVersion) <= 0) throw new HttpError(409, "این نسخه قدیمی‌تر یا هم‌نسخه با نسخهٔ نصب‌شده است");
      if (manifest.minimumVersion && installedVersion !== "نامشخص" && compareVersions(installedVersion, manifest.minimumVersion) < 0) throw new HttpError(409, `این بسته به نسخهٔ ${manifest.minimumVersion} یا بالاتر نیاز دارد`);
      const existingIds = (await readdir(root(), { withFileTypes: true })).filter((entry) => entry.isDirectory() && /^[a-f0-9-]{36}$/.test(entry.name)).map((entry) => entry.name);
      const existingStatuses = (await Promise.all(existingIds.map(readStatus))).filter((item): item is UpdateStatus => !!item);
      if (existingStatuses.some((item) => item.state === "ready" || item.state === "applying")) throw new HttpError(409, "یک بستهٔ آماده یا در حال اجرا وجود دارد؛ ابتدا وضعیت آن را مشخص کنید");
      const id = randomUUID(), base = path.join(root(), id), filesDir = path.join(base, "files");
      await mkdir(filesDir, { recursive: true, mode: 0o700 });
      try {
        await writeFile(path.join(base, "manifest.json"), entries.get("manifest.json")!, { mode: 0o600 });
        await writeFile(path.join(base, "manifest.sig"), entries.get("manifest.sig")!, { mode: 0o600 });
        for (const fileItem of manifest.files) {
          const target = path.join(filesDir, fileItem.path);
          await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
          await writeFile(target, entries.get(fileItem.path)!, { flag: "wx", mode: 0o600 });
        }
        const status: UpdateStatus = { id, state: "ready", version: manifest.version, createdAt: new Date().toISOString(), fileCount: manifest.files.length, migrationCount: manifest.files.filter((fileItem) => fileItem.path.startsWith("drizzle/")).length, updatedAt: new Date().toISOString() };
        await saveStatus(status);
        await audit(db, { userId: user.id, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local", ua: req.headers.get("user-agent") }, "admin.update.upload", "update_package", id, null, { version: manifest.version, fileCount: status.fileCount, migrationCount: status.migrationCount });
        return NextResponse.json({ package: status, applyEnabled: process.env.UPDATE_APPLY_ENABLED === "true" && process.env.NODE_ENV === "production" }, { status: 201 });
      } catch (error) { await rm(base, { recursive: true, force: true }); throw error; }
    }

    const body = await req.json().catch(() => ({})) as { action?: string; id?: string };
    if (body.action !== "apply" || !body.id || !/^[a-f0-9-]{36}$/.test(body.id)) throw new HttpError(400, "درخواست به‌روزرسانی نامعتبر است");
    if (process.env.NODE_ENV !== "production" || process.env.UPDATE_APPLY_ENABLED !== "true") throw new HttpError(503, "اجرای به‌روزرسانی در این سرور فعال نشده است");
    const status = await readStatus(body.id);
    if (!status || status.state !== "ready") throw new HttpError(409, "بستهٔ آمادهٔ اجرا پیدا نشد یا قبلاً اجرا شده است");
    const next = { ...status, state: "applying" as const, message: "درخواست ثبت شد؛ عملیات امن روی سرور آغاز می‌شود.", updatedAt: new Date().toISOString() };
    await saveStatus(next);
    const child = spawn(process.execPath, [path.join(process.cwd(), "scripts", "apply-update.mjs"), body.id], { cwd: process.cwd(), detached: true, stdio: "ignore", env: process.env });
    child.once("error", async () => { await saveStatus({ ...next, state: "failed", message: "اجرای worker به‌روزرسانی آغاز نشد.", updatedAt: new Date().toISOString() }).catch(() => null); });
    child.unref();
    await audit(db, { userId: user.id, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local", ua: req.headers.get("user-agent") }, "admin.update.apply", "update_package", body.id, { state: status.state }, { state: "applying", version: status.version });
    return NextResponse.json({ package: next });
  } catch (error) { return respondError(error); }
}
