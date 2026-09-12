// Entry harness: mount hook useTransactions ASLI (bentuk branch ini — TANPA
// autoRefetchTransactions/refreshTransactions, itu milik Task 5 di branch
// terpisah), ekspos API-nya ke window supaya bisa disetir dari Playwright.
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
