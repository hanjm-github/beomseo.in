/**
 * @file src/App.jsx
 * @description Declares global providers and top-level route boundaries for the SPA shell.
 * Responsibilities:
 * - Compose providers, router setup, and lazy route loading at the app boundary.
 * Key dependencies:
 * - react-router-dom
 * - ./context/ThemeContext
 * - ./context/AuthContext
 * - react
 * Side effects:
 * - Influences client-side routing and navigation state.
 * - Interacts with browser runtime APIs.
 * Role in app flow:
 * - Primary orchestrator connecting providers, routing, and shared layout.
 */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { NetworkStatusProvider } from './context/NetworkStatusContext';
import { PwaInstallProvider } from './context/PwaInstallContext';
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
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

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
      <NetworkStatusProvider>
        <PwaInstallProvider>
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
                    <Route path="/gallery" element={<GalleryPage />} />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />
                    <Route path="/terms" element={<TermsOfServicePage />} />
                    <Route
                      path="*"
                      element={
                        <NotFoundPage
                          eyebrow="페이지 없음"
                          title="찾을 수 없는 페이지입니다."
                          description="입력한 주소가 잘못되었거나 페이지가 이동되었습니다. 홈이나 공지 메뉴에서 다시 시작해 주세요."
                          primaryAction={{ label: '홈으로', to: '/' }}
                          secondaryActions={[{ label: '공지 보기', to: '/notices/school' }]}
                        />
                      }
                    />
                  </Routes>
                </Suspense>
              </AppLayout>
            </Router>
          </AuthProvider>
        </PwaInstallProvider>
      </NetworkStatusProvider>
    </ThemeProvider>
  );
}

export default App;


