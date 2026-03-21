/**
 * @file src/pwa/events.js
 * @description Defines lightweight custom events shared between API clients and PWA UI helpers.
 */
export const NETWORK_REQUEST_FAILED_EVENT = 'app:network-request-failed';

/**
 * Broadcast a transport-level API failure so the offline overlay can react outside the request caller.
 */
export function emitNetworkRequestFailure(detail = {}) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(NETWORK_REQUEST_FAILED_EVENT, {
      detail: {
        timestamp: Date.now(),
        ...detail,
      },
    })
  );
}
