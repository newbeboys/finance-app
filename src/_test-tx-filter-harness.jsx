import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import { TransactionsPage } from './transactions-page';

// TEMP harness — bypasses Supabase auth, mounts TransactionsPage directly
// with mock data (>1 wallet, so the merged filter group shows all 3
// dropdowns) for visual verification of the new .tx-filter-group layout
// at narrow viewports. Not part of the app entry; delete after use.

const mockAccounts = [
  { id: 'a1', name: 'BCA Tabungan' },
  { id: 'a2', name: 'GoPay' },
  { id: 'a3', name: 'Cash' },
];

const now = new Date();
const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
const mockTx = [
  { id: 't1', amount: 500000, dateRaw: iso, date: '15 Jan', time: '10:00', category: 'gaji', method: 'Transfer', merchant: 'Kantor', note: '', wallet_id: 'a1' },
  { id: 't2', amount: -50000, dateRaw: iso, date: '15 Jan', time: '11:00', category: 'makan', method: 'Cash', merchant: 'Warteg', note: '', wallet_id: 'a2' },
];

ReactDOM.createRoot(document.getElementById('root')).render(
  <TransactionsPage
    accounts={mockAccounts}
    onAdd={() => {}}
    onScan={() => {}}
    transactions={mockTx}
    onDelete={() => {}}
    onUpdate={() => {}}
    customCategories={[]}
    isPro={false}
  />
);
