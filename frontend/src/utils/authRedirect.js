const AUTH_PATHS = new Set(['/login', '/signup']);

function toInternalPath(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    if (!value.startsWith('/') || value.startsWith('//')) {
      return null;
    }

    return value;
  }

  if (typeof value === 'object' && typeof value.pathname === 'string') {
    const pathname = value.pathname.startsWith('/') ? value.pathname : `/${value.pathname}`;

    if (pathname.startsWith('//')) {
      return null;
    }

    const search = typeof value.search === 'string' ? value.search : '';
    const hash = typeof value.hash === 'string' ? value.hash : '';

    return `${pathname}${search}${hash}`;
  }

  return null;
}

function isAuthPath(path) {
  if (!path) {
    return false;
  }

  const pathname = path.split(/[?#]/)[0];
  return AUTH_PATHS.has(pathname);
}

export function buildAuthRedirectState(location) {
  const from = toInternalPath(location);

  if (!from || isAuthPath(from)) {
    return undefined;
  }

  return { from };
}

export function resolveAuthRedirectTarget(from, fallback = '/') {
  const target = toInternalPath(from);

  if (!target || isAuthPath(target)) {
    return fallback;
  }

  return target;
}
