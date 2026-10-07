import { createHash, createPublicKey, verify, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { chmod, copyFile, lstat, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const id = process.argv[2];
const base = path.resolve(process.env.UPDATE_STORAGE_DIR || path.join(process.cwd(), 'storage', 'updates'));
const packageDir = path.join(base, id);
const statusFile = path.join(packageDir, 'status.json');
const root = process.cwd();
const safeId = /^[a-f0-9-]{36}$/.test(id || '');

async function status(state, message) {
  const old = JSON.parse(await readFile(statusFile, 'utf8'));
  const temp = `${statusFile}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify({ ...old, state, message, updatedAt: new Date().toISOString() }), { mode: 0o600 });
  await rename(temp, statusFile);
}
function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (chunk) => { err = (err + chunk.toString()).slice(-5000); });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} با کد ${code} متوقف شد${err ? `: ${err}` : ''}`)));
  });
}
function allowed(name) {
  return name === 'package.json' || name === 'yarn.lock' || name === 'next.config.ts' || name.startsWith('src/') || name.startsWith('public/') || /^drizzle\/\d{4}_[a-zA-Z0-9_-]+\.sql$/.test(name);
}
async function noSymlinkPath(target, includeLeaf = true) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('مسیر فایل از ریشه پروژه خارج شده است');
  const parts = relative.split(path.sep).slice(0, includeLeaf ? undefined : -1);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try { const st = await lstat(current); if (st.isSymbolicLink()) throw new Error('مسیر فایل شامل پیوند نمادین است'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
function verifyPackage(manifestBytes, signatureText, manifest, publicKeyPem) {
  const key = createPublicKey(publicKeyPem.replace(/\\n/g, '\n'));
  if (!verify(null, manifestBytes, key, Buffer.from(signatureText.trim(), 'base64'))) throw new Error('امضای بسته در زمان اجرا تأیید نشد');
  if (manifest.product !== 'organo-marketplace-shop' || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('manifest بسته معتبر نیست');
}
function parseDbUrl(input) {
  const url = new URL(input);
  return {
    args: ['--no-owner', '--no-acl', '--format=c', '--no-password', '--host', url.hostname, '--port', url.port || '5432', '--username', decodeURIComponent(url.username), '--dbname', decodeURIComponent(url.pathname.slice(1))],
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password), ...(url.searchParams.get('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode') } : {}) },
  };
}
async function backupDatabase(to) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL تنظیم نشده است؛ پیش از تغییر کد امکان تهیه پشتیبان نیست');
  const target = path.join(to, 'database.dump');
  const parsed = parseDbUrl(process.env.DATABASE_URL);
  await run('pg_dump', [...parsed.args, '--file', target], parsed.env);
  const st = await stat(target); if (!st.size) throw new Error('فایل پشتیبان دیتابیس خالی است');
}
async function waitForHealth() {
  const url = process.env.UPDATE_HEALTHCHECK_URL || `http://127.0.0.1:${process.env.PORT || '6008'}/api/health`;
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('آدرس health check باید به loopback همین سرور اشاره کند');
  const deadline = Date.now() + 60_000;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(2500), cache: 'no-store', redirect: 'error' });
      lastStatus = response.status;
      if (response.ok && (await response.json()).ok === true) return;
    } catch { /* Wait for PM2 to replace the old workers. */ }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`سلامت نسخهٔ جدید پس از راه‌اندازی تأیید نشد (HTTP ${lastStatus || 'بدون پاسخ'})`);
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
  return (crc ^ 0xffffffff) >>> 0;
}
function safeMigration(sql) {
  return !!sql.trim() && !/\b(DROP|TRUNCATE|DELETE|UPDATE|RENAME|CASCADE|RESTART\s+IDENTITY)\b/i.test(sql) && /\b(CREATE|ALTER|INSERT|SELECT|COMMENT|GRANT|REVOKE)\b/i.test(sql);
}
async function migrate(files, backup) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(99125)');
    await client.query('CREATE TABLE IF NOT EXISTS app_migrations (tag text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const file of files.filter((item) => item.path.startsWith('drizzle/')).sort((a, b) => a.path.localeCompare(b.path))) {
      const tag = path.basename(file.path);
      const exists = await client.query('SELECT 1 FROM app_migrations WHERE tag=$1', [tag]);
      if (exists.rowCount) continue;
      const sql = await readFile(path.join(packageDir, 'files', file.path), 'utf8');
      if (!safeMigration(sql)) throw new Error(`migration ناامن یا حذف‌کننده پذیرفته نیست: ${tag}`);
      await client.query('BEGIN');
      try { await client.query(sql); await client.query('INSERT INTO app_migrations(tag) VALUES($1)', [tag]); await client.query('COMMIT'); }
      catch (error) { await client.query('ROLLBACK'); throw new Error(`اجرای migration ${tag} ناموفق بود`); }
    }
  } finally { await client.query('SELECT pg_advisory_unlock(99125)').catch(() => null); client.release(); await pool.end(); }
}

let changed = [], backupDir = '', buildDir = '', oldBuild = '', oldBuildMoved = false, newBuildInstalled = false, migrationsAttempted = false;
try {
  if (!safeId) throw new Error('شناسه بسته نامعتبر است');
  if (process.env.NODE_ENV !== 'production' || process.env.UPDATE_APPLY_ENABLED !== 'true') throw new Error('اجرای آپدیت فقط روی سرور production که صریحاً فعال شده مجاز است');
  if (!process.env.UPDATE_PUBLIC_KEY_PEM) throw new Error('کلید عمومی ناشر در سرور تنظیم نشده است');
  await mkdir(path.join(base, 'backups'), { recursive: true, mode: 0o700 });
  backupDir = path.join(base, 'backups', id); await mkdir(path.join(backupDir, 'files'), { recursive: true, mode: 0o700 });

  const manifestBytes = await readFile(path.join(packageDir, 'manifest.json'));
  const signature = await readFile(path.join(packageDir, 'manifest.sig'), 'utf8');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  verifyPackage(manifestBytes, signature, manifest, process.env.UPDATE_PUBLIC_KEY_PEM);
  const current = JSON.parse(await readFile(path.join(packageDir, 'status.json'), 'utf8'));
  if (current.state !== 'applying' || current.version !== manifest.version) throw new Error('وضعیت بسته در صف اجرا معتبر نیست');
  for (const file of manifest.files) {
    if (!allowed(file.path)) throw new Error(`مسیر در فهرست فایل‌ها مجاز نیست: ${file.path}`);
    const content = await readFile(path.join(packageDir, 'files', file.path));
    if (content.length !== file.size || createHash('sha256').update(content).digest('hex') !== file.sha256) throw new Error(`هش فایل در زمان اجرا نادرست است: ${file.path}`);
    if (file.path.startsWith('drizzle/') && !safeMigration(content.toString('utf8'))) throw new Error(`migration حذف‌کننده مسدود شد: ${file.path}`);
  }
  const lock = path.join(base, 'update.lock');
  const lockHandle = await (await import('node:fs/promises')).open(lock, 'wx', 0o600);
  await lockHandle.writeFile(JSON.stringify({ id, pid: process.pid, startedAt: new Date().toISOString() })); await lockHandle.close();
  try {
    await status('applying', 'ابتدا پشتیبان پایگاه داده و فایل‌های هدف تهیه می‌شود.');
    await backupDatabase(backupDir);
    const currentVersionPath = path.join(base, 'current-version.json');
    try { await copyFile(currentVersionPath, path.join(backupDir, 'current-version.json')); } catch {}
    for (const file of manifest.files) {
      const target = path.resolve(root, file.path); await noSymlinkPath(target, false);
      const old = { path: file.path, existed: false, mode: 0o644 };
      try { const s = await lstat(target); if (s.isSymbolicLink() || !s.isFile()) throw new Error(`فایل هدف امن نیست: ${file.path}`); old.existed = true; old.mode = s.mode & 0o777; const copy = path.join(backupDir, 'files', file.path); await mkdir(path.dirname(copy), { recursive: true, mode: 0o700 }); await copyFile(target, copy); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      changed.push(old);
    }
    await writeFile(path.join(backupDir, 'manifest.json'), manifestBytes, { mode: 0o600 });

    for (const file of manifest.files) {
      const source = path.join(packageDir, 'files', file.path), target = path.resolve(root, file.path);
      await noSymlinkPath(target, false); await mkdir(path.dirname(target), { recursive: true, mode: 0o755 });
      const temporary = `${target}.${id}.tmp`; await copyFile(source, temporary); await chmod(temporary, 0o644); await rename(temporary, target);
    }
    if (manifest.files.some((file) => file.path === 'package.json' || file.path === 'yarn.lock')) {
      await status('applying', 'وابستگی‌های نسخهٔ امضاشده نصب می‌شوند.');
      await run('yarn', ['install', '--frozen-lockfile']);
    }
    buildDir = `.next-update-${id}`;
    await status('applying', 'نسخهٔ تازه در پوشهٔ موقت build می‌شود.');
    await run('yarn', ['build'], { ...process.env, NEXT_DIST_DIR: buildDir });

    await status('applying', 'پشتیبان دیتابیس آماده است؛ migrationهای افزایشی اجرا می‌شوند.');
    migrationsAttempted = true;
    await migrate(manifest.files, backupDir);
    oldBuild = path.join(backupDir, 'next-build');
    await rename(path.join(root, '.next'), oldBuild);
    oldBuildMoved = true;
    await rename(path.join(root, buildDir), path.join(root, '.next'));
    newBuildInstalled = true;
    await status('applying', 'فایل build جدید فعال شد؛ سرویس با PM2 بارگذاری مجدد می‌شود.');
    await run('pm2', ['reload', process.env.UPDATE_PM2_APP || 'organito-app', '--update-env']);
    await status('applying', 'در حال بررسی پاسخ سرویس و اتصال دیتابیس پس از راه‌اندازی مجدد.');
    await waitForHealth();
    await writeFile(currentVersionPath, JSON.stringify({ version: manifest.version, appliedAt: new Date().toISOString() }), { mode: 0o600 });
    await status('applied', `به‌روزرسانی ${manifest.version} با موفقیت انجام شد. نسخهٔ قبلی و پشتیبان دیتابیس در بخش نسخه‌های پشتیبان نگهداری شد.`);
  } finally { await rm(lock, { force: true }); }
} catch (error) {
  const message = error instanceof Error ? error.message : 'خطای نامشخص در به‌روزرسانی';
  try {
    if (changed.length) {
      for (const item of [...changed].reverse()) {
        const target = path.resolve(root, item.path), saved = path.join(backupDir, 'files', item.path);
        if (item.existed) { await mkdir(path.dirname(target), { recursive: true }); await copyFile(saved, target); await chmod(target, item.mode); }
        else await rm(target, { force: true });
      }
      if (newBuildInstalled) {
        const failedBuild = path.join(backupDir, 'failed-build');
        await rename(path.join(root, '.next'), failedBuild).catch(() => null);
      }
      if (oldBuildMoved) await rename(oldBuild, path.join(root, '.next')).catch(() => null);
      if (changed.some((file) => file.path === 'package.json' || file.path === 'yarn.lock')) await run('yarn', ['install', '--frozen-lockfile']).catch(() => null);
      if (newBuildInstalled) await run('pm2', ['reload', process.env.UPDATE_PM2_APP || 'organito-app', '--update-env']).catch(() => null);
    }
    if (buildDir) await rm(path.join(root, buildDir), { recursive: true, force: true }).catch(() => null);
  } catch {}
  await status('failed', `${message}${migrationsAttempted ? ' در صورت ثبت برخی migrationها، فقط migration افزایشی ثبت‌شده باقی می‌ماند؛ نسخهٔ کد قبلی بازگردانده شد.' : ''}`).catch(() => null);
  process.exitCode = 1;
}
