import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';

import { AppRouter } from './app/router/AppRouter';

function App() {
  return (
    <main className="container py-3 py-md-4">
      <header className="mb-3 mb-md-4">
        <h1 className="mb-2">Daynest</h1>
        <nav className="nav nav-pills gap-2">
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/today">
            Today
          </NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/calendar">
            Calendar
          </NavLink>
        </nav>
      </header>
      <AppRouter />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
