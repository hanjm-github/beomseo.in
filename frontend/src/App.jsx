import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

import AppLayout from './layout/AppLayout';
import MainPage from './pages/MainPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import NoticesPage from './pages/NoticesPage';
import CommunityPage from './pages/CommunityPage';
import SchoolInfoPage from './pages/SchoolInfoPage';
import GalleryPage from './pages/GalleryPage';

import './styles/globals.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppLayout>
            <Routes>
              <Route path="/" element={<MainPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/notices/*" element={<NoticesPage />} />
              <Route path="/community/*" element={<CommunityPage />} />
              <Route path="/school-info/*" element={<SchoolInfoPage />} />
              <Route path="/gallery/*" element={<GalleryPage />} />
            </Routes>
          </AppLayout>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
