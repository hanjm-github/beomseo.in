export const isMockFallbackEnabled =
  Boolean(import.meta.env.DEV) && import.meta.env.VITE_ENABLE_API_MOCKS === '1';

export function shouldUseMockFallback(error) {
  if (!isMockFallbackEnabled) return false;
  return !error?.response;
}
