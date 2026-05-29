/**
 * @file src/config/env.js
 * @description Reads and normalizes frontend environment configuration values.
 * This module is the single source of truth for feature flags, API origins,
 * upload limits, and Firebase Web Push settings used across the SPA.
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
// Sports league, field trip, and meal APIs can be moved to a dedicated FastAPI
// origin without forcing the rest of the app off the main Flask backend.
export const FASTAPI_BASE_URL = readBaseUrlEnv('VITE_SPORTS_LEAGUE_API_URL', API_BASE_URL);
export const VALUE_PICK_BOARD_ENABLED = readBooleanEnv(
  'VITE_VALUE_PICK_BOARD_ENABLED',
  true
);
export const CLUB_RECRUIT_BOARD_ENABLED = readBooleanEnv(
  'VITE_CLUB_RECRUIT_BOARD_ENABLED',
  true
);
export const SUBJECT_CHANGES_BOARD_ENABLED = readBooleanEnv(
  'VITE_SUBJECT_CHANGES_BOARD_ENABLED',
  true
);
export const BOSPI_BOARD_ENABLED = readBooleanEnv('VITE_BOSPI_BOARD_ENABLED', true);
export const STUDY_WITH_BEOMSEO_BOARD_ENABLED = readBooleanEnv(
  'VITE_STUDY_WITH_BEOMSEO_BOARD_ENABLED',
  true
);
export const FIELD_TRIP_BOARD_ENABLED = readBooleanEnv(
  'VITE_FIELD_TRIP_BOARD_ENABLED',
  true
);
// Route slugs are shared keys for navigation, routing, prerender, and SEO filters.
export const COMMUNITY_BOARD_FEATURE_FLAGS = Object.freeze({
  'value-pick': VALUE_PICK_BOARD_ENABLED,
  'club-recruit': CLUB_RECRUIT_BOARD_ENABLED,
  subjects: SUBJECT_CHANGES_BOARD_ENABLED,
  bospi: BOSPI_BOARD_ENABLED,
  'study-with-beomseo': STUDY_WITH_BEOMSEO_BOARD_ENABLED,
  'field-trip': FIELD_TRIP_BOARD_ENABLED,
});
// Web Push is considered configured only when every required Firebase key exists.
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
export const FIELD_TRIP_VIDEO_MAX_SIZE_MB = readPositiveIntEnv(
  'VITE_FIELD_TRIP_VIDEO_MAX_SIZE_MB',
  500
);
export const FIELD_TRIP_VIDEO_MAX_SIZE_BYTES = FIELD_TRIP_VIDEO_MAX_SIZE_MB * 1024 * 1024;

export const PETITION_THRESHOLD_DEFAULT = readPositiveIntEnv(
  'VITE_PETITION_THRESHOLD_DEFAULT',
  50
);

export const ALLOWED_ASSET_HOSTS = readCsvEnv('VITE_ALLOWED_ASSET_HOSTS', []);


