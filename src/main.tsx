import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './app/AuthContext';
import App from './app/App';
import './styles/fresh-ui.css';
import './styles/brand-system.css';
import './styles/reference-shell.css';

import type { ErrorInfo, ReactNode } from 'react';

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ENG HUB interface error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main dir="rtl" role="alert" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f6fb', color: '#17243a', fontFamily: 'system-ui, sans-serif' }}>
          <section style={{ width: 'min(100%, 460px)', padding: 28, borderRadius: 20, background: '#fff', textAlign: 'center', boxShadow: '0 12px 40px rgba(20,35,60,.10)' }}>
            <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>حدث خطأ غير متوقع</h1>
            <p style={{ margin: '0 0 20px', lineHeight: 1.9, color: '#64748b' }}>تعذر عرض هذه الصفحة. يمكنك إعادة تحميل المنصة والمحاولة مرة أخرى.</p>
            <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, padding: '0 22px', border: 0, borderRadius: 11, background: '#6254d9', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>إعادة تحميل الصفحة</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    let refreshing = false;
    // When the updated worker takes control, reload once so the browser
    // fetches the latest index.html and its current hashed JavaScript bundle.
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=9`)
      .then((registration) => registration.update())
      .catch((error) => console.warn('ENG HUB service worker registration failed.', error));
  });
}
