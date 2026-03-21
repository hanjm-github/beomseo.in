import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'public', 'firebase-messaging-sw.js');


async function main() {
  await rm(outputPath, { force: true });
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
