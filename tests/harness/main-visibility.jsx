// Entry harness untuk tests/owner-visibility.harness.mjs: mount hook
// useTransactions ASLI, ekspos API-nya ke window supaya bisa disetir Playwright.
// Dipasangkan dengan stub-visibility.js lewat visibility.html +
// vite.visibility.config.js. Sengaja TERPISAH dari main.jsx (yang probe-nya
// pakai userId lain + expose kontrol lock) — alasannya di stub-visibility.js.
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../src/i18n';
import { useTransactions } from '../../src/hooks/useTransactions';

function Probe() {
  const api = useTransactions('owner-1', { maxTransactionsPerMonth: Infinity });
  window.__api = api;   // identitas berubah tiap render → pembaca harus ambil ulang
  return <div id="ready">{api.loading ? 'loading' : 'ready'}</div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Probe />);
