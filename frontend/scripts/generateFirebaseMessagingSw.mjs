import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const templatePath = path.join(rootDir, 'src', 'pwa', 'firebase-messaging-sw.template.js');
const outputPath = path.join(rootDir, 'public', 'firebase-messaging-sw.js');
const packageJsonPath = path.join(rootDir, 'package.json');


function resolveFirebaseVersion(versionRange) {
  const match = String(versionRange || '').match(/\d+\.\d+\.\d+/);
  return match ? match[0] : '12.4.0';
}


async function main() {
  const mode = process.argv[2] || 'development';
  const env = loadEnv(mode, rootDir, '');
  const template = await readFile(templatePath, 'utf8');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const firebaseVersion = resolveFirebaseVersion(packageJson.dependencies?.firebase);
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
  };

  const enabled = Object.values(firebaseConfig).every(Boolean) && Boolean(env.VITE_FIREBASE_VAPID_KEY);
  const rendered = template
    .replaceAll('__FIREBASE_ENABLED__', JSON.stringify(enabled))
    .replaceAll('__FIREBASE_VERSION__', firebaseVersion)
    .replaceAll('__FIREBASE_CONFIG__', JSON.stringify(firebaseConfig, null, 2));

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, rendered, 'utf8');
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
