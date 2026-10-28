import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ChatDashboard } from './pages/ChatDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

function MainApp() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('login');

  // Initialize theme & multilingual typography settings across platform
  useEffect(() => {
    const theme = localStorage.getItem('gov_rag_theme') || 'default-dark';
    const textSize = localStorage.getItem('gov_rag_text_size') || 'normal';
    const lineHeight = localStorage.getItem('gov_rag_line_height') || 'balanced';
    const letterSpacing = localStorage.getItem('gov_rag_letter_spacing') || 'normal';
    const fontFamily = localStorage.getItem('gov_rag_font_family') || 'noto-sans';
    const fontWeight = localStorage.getItem('gov_rag_font_weight') || 'normal';
    const indicMode = localStorage.getItem('gov_rag_indic_mode') !== 'false';

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-text-size', textSize);
    document.documentElement.setAttribute('data-line-height', lineHeight);
    document.documentElement.setAttribute('data-letter-spacing', letterSpacing);
    document.documentElement.setAttribute('data-font-family', fontFamily);
    document.documentElement.setAttribute('data-font-weight', fontWeight);
    document.documentElement.setAttribute('data-indic-mode', indicMode ? 'true' : 'false');
  }, []);

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        // If logged in and on an auth page, redirect to chat
        if (currentPage === 'login' || currentPage === 'register' || currentPage === 'forgot-password') {
          setCurrentPage('chat');
        }
      } else {
        // If logged out and on a protected page, redirect to login
        if (currentPage === 'chat' || currentPage === 'admin') {
          setCurrentPage('login');
        }
      }
    }
  }, [isAuthenticated, loading]);

  const handleNavigate = (page) => {
    if (page === 'admin' && !isAdmin) {
      alert('Access Denied: Admin privileges required.');
      return;
    }
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: '#818cf8',
        fontSize: '15px',
        fontWeight: 600,
        gap: '12px'
      }}>
        <div className="status-dot status-dot-active mic-recording-pulse" />
        <span>Initializing GovAssist AI Platform...</span>
      </div>
    );
  }

  switch (currentPage) {
    case 'register':
      return <Register onNavigate={handleNavigate} />;
    case 'forgot-password':
      return <ForgotPassword onNavigate={handleNavigate} />;
    case 'chat':
      return isAuthenticated ? <ChatDashboard onNavigate={handleNavigate} /> : <Login onNavigate={handleNavigate} />;
    case 'admin':
      return isAuthenticated && isAdmin ? <AdminDashboard onNavigate={handleNavigate} /> : <ChatDashboard onNavigate={handleNavigate} />;
    case 'login':
    default:
      return isAuthenticated ? <ChatDashboard onNavigate={handleNavigate} /> : <Login onNavigate={handleNavigate} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
