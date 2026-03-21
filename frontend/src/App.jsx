/**
 * @file src/App.jsx
 * @description Composes the SPA shell, provider stack, and top-level lazy routes.
 * Responsibilities:
 * - Mount the global provider chain used by every route.
 * - Define the top-level router entries and shared suspense fallback.
 * Key dependencies:
 * - react-router-dom
 * - ./context/ThemeContext
 * - ./context/AuthContext
 * - react
 * Side effects:
 * - Resets scroll position after route changes.
 * Role in app flow:
 * - App boundary connecting layout, runtime providers, and route-level pages.
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
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

import './styles/globals.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // The layout persists across navigations, so each pathname change must reset scroll explicitly.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);

  return null;
}

function RouteFallback() {
  return <div className="route-fallback">페이지를 불러오는 중...</div>;
}

function App() {
  return (
    // Provider order is intentional: UI state first, then connectivity/PWA helpers, then auth/session state.
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
