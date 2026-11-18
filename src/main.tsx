import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './app/AuthContext';
import App from './app/App';
import './styles/fresh-ui.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
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
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=3`)
      .then((registration) => registration.update())
      .catch((error) => console.warn('ENG HUB service worker registration failed.', error));
  });
}
