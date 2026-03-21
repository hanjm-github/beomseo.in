/**
 * @file src/layout/AppLayout.jsx
 * @description Defines the persistent shell wrapped around every routed page.
 * Responsibilities:
 * - Render shared navigation, footer, skip link, and offline overlay host.
 * Key dependencies:
 * - ../components/Header
 * - ../components/Footer
 * - ../styles/layout.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Provides the top-level visual frame used by all routes.
 */
import Header from '../components/Header';
import Footer from '../components/Footer';
import OfflineGate from '../components/pwa/OfflineGate';
import '../styles/layout.css';

/**
 * Wrap routed content with the persistent site shell so route files stay focused on page logic.
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
