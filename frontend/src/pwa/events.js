export const NETWORK_REQUEST_FAILED_EVENT = 'app:network-request-failed';

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
