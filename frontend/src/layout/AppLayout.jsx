/**
 * @file src/layout/AppLayout.jsx
 * @description Provides shared layout structure reused by routed pages.
 * Responsibilities:
 * - Keep global layout concerns consistent across all feature routes.
 * Key dependencies:
 * - ../components/Header
 * - ../components/Footer
 * - ../styles/layout.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Provides consistent shell structure around route-rendered page content.
 */
import Header from '../components/Header';
import Footer from '../components/Footer';
import OfflineGate from '../components/pwa/OfflineGate';
import '../styles/layout.css';

/**
 * AppLayout
 * Wraps all pages with the site-wide header, footer, and main container.
 * Keeps layout responsibilities centralized and ready for future mega-menu/search overlays.
 */
export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        본문으로 바로가기
      </a>
      <Header />
      <main id="main" className="app-main">
        {children}
      </main>
      <Footer />
      <OfflineGate />
    </div>
  );
}


