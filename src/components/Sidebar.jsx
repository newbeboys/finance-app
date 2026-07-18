import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconDashboard, IconTx, IconSave, IconBudget,
  IconChart, IconReport, IconWallet, IconSettings,
} from '../icons';

// Hutang/Piutang — ikon sama persis dengan BottomNav (dua panah berlawanan arah)
const IconDebt = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h13l-3-3" />
    <path d="M20 16H7l3 3" />
  </svg>
);

// Menu identik dengan BottomNav (MAIN_NAV + MORE_NAV, urutan sama).
// Sidebar menampilkan semuanya sebagai satu daftar rata — selalu ada label,
// tidak ada mode icon-only di breakpoint manapun. Hanya tampil di ≥750px (CSS).
const NAV = [
  { id: "dashboard",    tKey: "nav.beranda",    Icon: IconDashboard },
  { id: "transactions", tKey: "nav.transaksi",  Icon: IconTx },
  { id: "savings",      tKey: "nav.tabungan",   Icon: IconSave },
  { id: "budgets",      tKey: "nav.anggaran",   Icon: IconBudget },
  { id: "analytics",    tKey: "nav.analitik",   Icon: IconChart },
  { id: "reports",      tKey: "nav.laporan",    Icon: IconReport },
  { id: "wallets",      tKey: "nav.dompet",     Icon: IconWallet },
  { id: "debts",        tKey: "nav.hutang",     Icon: IconDebt },
  { id: "settings",     tKey: "nav.pengaturan", Icon: IconSettings },
];

export function Sidebar({ active, onNav }) {
  const { t } = useTranslation();

  return (
    <aside className="sidebar" data-tour="sidebar" aria-label={t('nav.beranda')}>
      <div className="sidebar-brand">
        <span className="sidebar-mark">F</span>
        <span className="serif sidebar-wordmark">FinanceApp</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ id, tKey, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNav(id)}
              aria-current={isActive ? "page" : undefined}
              className={"sidebar-item" + (isActive ? " is-active" : "")}
            >
              <span className="sidebar-item-icon"><Icon size={20} /></span>
              <span className="sidebar-item-label">{t(tKey)}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
