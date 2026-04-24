import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';

import { AppRouter } from './app/router/AppRouter';

function App() {
  return (
    <main className="container py-3 py-md-4">
      <header className="mb-3 mb-md-4">
        <h1 className="mb-2">Daynest</h1>
        <nav className="nav nav-pills gap-2">
          <Link className="nav-link" to="/today">
            Today
          </Link>
          <Link className="nav-link" to="/calendar">
            Calendar
          </Link>
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
