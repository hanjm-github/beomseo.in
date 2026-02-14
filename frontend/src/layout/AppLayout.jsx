import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles/layout.css';

/**
 * AppLayout
 * Wraps all pages with the site-wide header, footer, and main container.
 * Keeps layout responsibilities centralized and ready for future mega-menu/search overlays.
 */
export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">{children}</main>
      <Footer />
    </div>
  );
}
