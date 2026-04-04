import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const filesToRemove = [
  path.join(rootDir, 'public', 'firebase-messaging-sw.js'),
  path.join(rootDir, 'public', 'robots.txt'),
  path.join(rootDir, 'public', 'sitemap.xml'),
];


async function main() {
  await Promise.all(filesToRemove.map((targetPath) => rm(targetPath, { force: true })));
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
