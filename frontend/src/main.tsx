import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';

import { AppRouter } from './app/router/AppRouter';
import { AuthProvider, useAuth } from './app/providers/AuthProvider';

function App() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();

  return (
    <main className="container py-3 py-md-4">
      <header className="mb-3 mb-md-4 d-flex flex-column gap-3">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
          <div>
            <h1 className="mb-1">Daynest</h1>
            <p className="text-muted mb-0">Daily flow, calendar planning, and household tracking.</p>
          </div>
          {isAuthenticated && user ? (
            <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-2">
              <div className="small text-muted text-sm-end">
                <div className="fw-semibold text-body">{user.full_name}</div>
                <div>{user.email}</div>
              </div>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={logout}>
                Logout
              </button>
            </div>
          ) : !isLoading ? (
            <NavLink className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-primary'}`} to="/auth">
              Login
            </NavLink>
          ) : null}
        </div>
        <nav className="nav nav-pills gap-2">
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/today">
            Today
          </NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/calendar">
            Calendar
          </NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/medication">
            Medication
          </NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/templates">
            Templates
          </NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/settings">
            Settings
          </NavLink>
        </nav>
      </header>
      <AppRouter />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
