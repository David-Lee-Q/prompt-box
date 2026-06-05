import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if (!window.indexedDB) {
  document.getElementById('root')!.innerHTML = `
    <div style="padding: 2rem; text-align: center; font-family: sans-serif;">
      <h1>浏览器不支持</h1>
      <p>当前浏览器不支持 IndexedDB，请使用现代浏览器（Chrome/Firefox/Edge/Safari）访问。</p>
    </div>`;
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Register service worker in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
