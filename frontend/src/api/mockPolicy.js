export const ENABLE_API_MOCKS =
  Boolean(import.meta.env.DEV) && import.meta.env.VITE_ENABLE_API_MOCKS === '1';

export function shouldUseMockFallback(error) {
  if (!ENABLE_API_MOCKS) return false;
  return !error?.response;
}
