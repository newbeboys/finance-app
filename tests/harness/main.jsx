// Entry harness: mount hook useTransactions ASLI, ekspos API-nya ke window
// supaya bisa disetir dari Playwright.
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../src/i18n';
import { useTransactions } from '../../src/hooks/useTransactions';
import { setAppLocked, isAppLocked, subscribeAppLock } from '../../src/hooks/useAutoLock';

function Probe() {
  const api = useTransactions('user-1', { maxTransactionsPerMonth: Infinity });
  window.__api = api;   // identitas berubah tiap render → pembaca harus ambil ulang
  return <div id="ready">{api.loading ? 'loading' : 'ready'}</div>;
}

window.__lock = { setAppLocked, isAppLocked, subscribeAppLock };
ReactDOM.createRoot(document.getElementById('root')).render(<Probe />);
