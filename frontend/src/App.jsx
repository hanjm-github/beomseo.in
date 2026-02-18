import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Suspense, lazy, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import AppLayout from './layout/AppLayout';
const MainPage = lazy(() => import('./pages/MainPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const NoticesPage = lazy(() => import('./pages/NoticesPage'));
const CommunityRouter = lazy(() => import('./pages/CommunityRouter'));
const SchoolInfoPage = lazy(() => import('./pages/SchoolInfoPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));

import './styles/globals.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Instant jump for better perceived performance
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);

  return null;
}

function RouteFallback() {
  return <div className="route-fallback">페이지를 불러오는 중...</div>;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <AppLayout>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<MainPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/notices/*" element={<NoticesPage />} />
                <Route path="/community/*" element={<CommunityRouter />} />
                <Route path="/school-info/*" element={<SchoolInfoPage />} />
                <Route path="/gallery/*" element={<GalleryPage />} />
              </Routes>
            </Suspense>
          </AppLayout>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
