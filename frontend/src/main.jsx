/**
 * @file src/main.jsx
 * @description Bootstraps the React runtime and mounts the root application component.
 * Responsibilities:
 * - Initialize the React application tree in the browser entrypoint.
 * Key dependencies:
 * - react
 * - react-dom/client
 * - ./App.jsx
 * Side effects:
 * - Interacts with browser runtime APIs.
 * Role in app flow:
 * - Entry point that hands control to App and routed feature modules.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  };

  window.addEventListener('load', registerServiceWorker, { once: true });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

