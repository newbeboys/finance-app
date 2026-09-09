// debug-debt-proof.jsx — SEMENTARA, alat bantu manual untuk mengetes
// generateDebtProof() (src/lib/debtProof.js) langsung di browser.
//
// HAPUS file ini + baris import/mount-nya di src/main.jsx setelah 4 PDF
// di bawah sudah dicek dan dikonfirmasi OK. JANGAN sampai ketinggalan
// di kode final / ikut ter-commit ke production build.
//
// (Sudah dijaga import.meta.env.DEV di main.jsx supaya tidak pernah
// muncul di production build meski lupa dihapus — tapi tetap harus dihapus.)

import React from 'react';
import { generateDebtProof } from './lib/debtProof';

const today = new Date();
const inAWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function makeDummyDebt({ id, cash_disbursed_at_creation }) {
  return {
    id,
    type: 'receivable',
    person_name: 'Budi',
    note: '',
    amount: 500000,
    paid: 0,
    remaining: 500000,
    wallet_id: null,
    date: iso(today),
    due_date: iso(inAWeek),
    status: 'active',
    is_deleted: false,
    is_locked: false,
    cash_disbursed_at_creation,
    created_at: today.toISOString(),
  };
}

const VARIANTS = [
  { key: 'a', label: 'a) Basic, sudah dikasih uang', opts: { isPro: false }, cash_disbursed_at_creation: true },
  { key: 'b', label: 'b) Basic, belum ditagih',       opts: { isPro: false }, cash_disbursed_at_creation: false },
  { key: 'c', label: 'c) Pro, sudah dikasih uang',    opts: { isPro: true },  cash_disbursed_at_creation: true },
  { key: 'd', label: 'd) Pro, belum ditagih',         opts: { isPro: true },  cash_disbursed_at_creation: false },
];

export default function DebugDebtProof() {
  const [status, setStatus] = React.useState({});

  const run = async (v) => {
    setStatus((s) => ({ ...s, [v.key]: '…' }));
    const debt = makeDummyDebt({ id: `debug-${v.key}test`, cash_disbursed_at_creation: v.cash_disbursed_at_creation });
    const { error } = await generateDebtProof(debt, [], v.opts);
    setStatus((s) => ({ ...s, [v.key]: error ? `GAGAL: ${error.message}` : 'OK ✓' }));
  };

  return (
    <div style={{
      position: 'fixed', bottom: 12, right: 12, zIndex: 99999,
      background: '#2A2C20', color: '#FBF8EE', padding: 12, borderRadius: 10,
      fontFamily: 'monospace', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.35)',
      maxWidth: 280,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>🧪 debug: debtProof</div>
      {VARIANTS.map((v) => (
        <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <button
            onClick={() => run(v)}
            style={{ background: '#5C6B4C', color: '#fff', border: 0, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
          >
            {v.label}
          </button>
          <span style={{ opacity: 0.8 }}>{status[v.key] || ''}</span>
        </div>
      ))}
    </div>
  );
}
