/**
 * @file src/api/mockPolicy.js
 * @description Encapsulates backend API contracts, normalization, and fallback behavior.
 * Responsibilities:
 * - Expose a stable API-facing interface for feature code while shielding transport details.
 * Key dependencies:
 * - Module-local logic without direct import dependencies.
 * Side effects:
 * - Reads build-time feature flags to decide whether mock fallback is enabled.
 * Role in app flow:
 * - Acts as the data boundary between UI code and backend HTTP endpoints.
 */
export const ENABLE_API_MOCKS =
  Boolean(import.meta.env.DEV) && import.meta.env.VITE_ENABLE_API_MOCKS === '1';

/**
 * shouldUseMockFallback module entry point.
 */
export function shouldUseMockFallback(error) {
  if (!ENABLE_API_MOCKS) return false;
  // Limit fallback to transport failures so backend contract errors remain visible during development.
  return !error?.response;
}


