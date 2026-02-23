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

function readCsvEnv(key, fallback = []) {
  const value = readEnvValue(key);
  if (typeof value !== 'string') return [...fallback];
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : [...fallback];
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

export const UPLOAD_MAX_ATTACHMENTS = readPositiveIntEnv('VITE_UPLOAD_MAX_ATTACHMENTS', 5);
export const UPLOAD_MAX_IMAGES = readPositiveIntEnv('VITE_UPLOAD_MAX_IMAGES', 5);
export const UPLOAD_MAX_FILE_SIZE_MB = readPositiveIntEnv('VITE_UPLOAD_MAX_FILE_SIZE_MB', 10);
export const UPLOAD_MAX_FILE_SIZE_BYTES = UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;

export const PETITION_THRESHOLD_DEFAULT = readPositiveIntEnv(
  'VITE_PETITION_THRESHOLD_DEFAULT',
  50
);

export const ALLOWED_ASSET_HOSTS = readCsvEnv('VITE_ALLOWED_ASSET_HOSTS', []);


