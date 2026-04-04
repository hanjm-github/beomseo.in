import { useLocation } from 'react-router-dom';
import SEO from '../components/SEO';
import { getStaticRouteSeo, isNoindexRoute } from './policy';

export default function AppRouteSeo() {
  const { pathname } = useLocation();
  const staticPolicy = getStaticRouteSeo(pathname);

  if (staticPolicy?.indexable === false) {
    return <SEO path={pathname} />;
  }

  if (isNoindexRoute(pathname)) {
    return <SEO path={pathname} noindex />;
  }

  return null;
}
