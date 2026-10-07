import { generateKeyPairSync } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = process.argv[2] ? path.resolve(process.argv[2]) : '';
if (!directory || directory === process.cwd() || directory.startsWith(`${process.cwd()}${path.sep}`)) {
  console.error('یک پوشهٔ امن خارج از مخزن پروژه بدهید تا کلید خصوصی در مخزن ذخیره نشود.');
  process.exit(2);
}
await mkdir(directory, { recursive: true, mode: 0o700 });
const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const privatePath = path.join(directory, 'update-private.pem');
const publicPath = path.join(directory, 'update-public.pem');
await writeFile(privatePath, privateKey, { flag: 'wx', mode: 0o600 });
await writeFile(publicPath, publicKey, { flag: 'wx', mode: 0o644 });
await chmod(privatePath, 0o600);
console.log(`کلید خصوصی را محرمانه نگه‌دارید: ${privatePath}`);
console.log(`کلید عمومی را فقط در متغیر UPDATE_PUBLIC_KEY_PEM سرور قرار دهید: ${publicPath}`);
