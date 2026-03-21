/**
 * @file src/config/env.js
 * @description Reads and normalizes frontend environment configuration values.
 * Responsibilities:
 * - Encapsulate file-local responsibilities in support of the overall frontend architecture.
 * Key dependencies:
 * - Module-local logic without direct import dependencies.
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Participates as a supporting module in the frontend runtime graph.
 */
function readStringEnv(key, fallback) {
  const value = readEnvValue(key);
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function readPositiveIntEnv(key, fallback) {
  const value = Number.parseInt(readEnvValue(key), 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function readBaseUrlEnv(key, fallback) {
  const value = readStringEnv(key, fallback);
  return value.replace(/\/$/, '');
}

function readCsvEnv(key, fallback = []) {
  const value = readEnvValue(key);
  if (typeof value !== 'string') return [...fallback];
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : [...fallback];
}

function readBooleanEnv(key, fallback) {
  const value = readEnvValue(key);
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function readEnvValue(key) {
  if (typeof import.meta !== 'undefined' && import.meta?.env) {
    return import.meta.env[key];
  }
  const nodeEnv = globalThis?.process?.env;
  if (nodeEnv) {
    return nodeEnv[key];
  }
  return undefined;
}

export const APP_NAME = readStringEnv('VITE_APP_NAME', 'beomseo.in');
export const API_BASE_URL = readBaseUrlEnv('VITE_API_URL', 'http://localhost:5000');
export const FASTAPI_BASE_URL = readBaseUrlEnv('VITE_SPORTS_LEAGUE_API_URL', API_BASE_URL);
export const CLUB_RECRUIT_BOARD_ENABLED = readBooleanEnv(
  'VITE_CLUB_RECRUIT_BOARD_ENABLED',
  true
);
export const FIREBASE_API_KEY = readStringEnv('VITE_FIREBASE_API_KEY', '');
export const FIREBASE_AUTH_DOMAIN = readStringEnv('VITE_FIREBASE_AUTH_DOMAIN', '');
export const FIREBASE_PROJECT_ID = readStringEnv('VITE_FIREBASE_PROJECT_ID', '');
export const FIREBASE_STORAGE_BUCKET = readStringEnv('VITE_FIREBASE_STORAGE_BUCKET', '');
export const FIREBASE_MESSAGING_SENDER_ID = readStringEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '');
export const FIREBASE_APP_ID = readStringEnv('VITE_FIREBASE_APP_ID', '');
export const FIREBASE_VAPID_KEY = readStringEnv('VITE_FIREBASE_VAPID_KEY', '');
export const FIREBASE_CONFIG = Object.freeze({
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
});
export const FIREBASE_MESSAGING_ENABLED = Boolean(
  FIREBASE_API_KEY &&
    FIREBASE_AUTH_DOMAIN &&
    FIREBASE_PROJECT_ID &&
    FIREBASE_STORAGE_BUCKET &&
    FIREBASE_MESSAGING_SENDER_ID &&
    FIREBASE_APP_ID &&
    FIREBASE_VAPID_KEY
);

export const UPLOAD_MAX_ATTACHMENTS = readPositiveIntEnv('VITE_UPLOAD_MAX_ATTACHMENTS', 5);
export const UPLOAD_MAX_IMAGES = readPositiveIntEnv('VITE_UPLOAD_MAX_IMAGES', 5);
export const UPLOAD_MAX_FILE_SIZE_MB = readPositiveIntEnv('VITE_UPLOAD_MAX_FILE_SIZE_MB', 10);
export const UPLOAD_MAX_FILE_SIZE_BYTES = UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;

export const PETITION_THRESHOLD_DEFAULT = readPositiveIntEnv(
  'VITE_PETITION_THRESHOLD_DEFAULT',
  50
);

export const ALLOWED_ASSET_HOSTS = readCsvEnv('VITE_ALLOWED_ASSET_HOSTS', []);


