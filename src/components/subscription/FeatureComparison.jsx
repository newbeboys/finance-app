import React, { useState } from 'react';
import './FeatureComparison.css';

const PLANS = [
  { id: 'monthly', label: 'Monthly',  price: 30000,  perMonth: 30000, period: '/bulan', savePercent: null },
  { id: '6months', label: '6 Bulan',  price: 140000, perMonth: 23333, period: '/6 bln', savePercent: 22 },
  { id: 'annual',  label: 'Tahunan',  price: 270000, perMonth: 22500, period: '/tahun', savePercent: 25 },
];

const FEATURES = [
  { label: 'Transaksi',              basic: 'Tak terbatas', pro: 'Tak terbatas' },
  { label: 'Custom kategori',        basic: 'Maks. 3',      pro: 'Tak terbatas' },
  { label: 'Dompet',                 basic: '1 dompet',     pro: 'Tak terbatas' },
  { label: 'Goals tabungan',         basic: 'Maks. 2',      pro: 'Tak terbatas' },
  { label: 'Transaksi berulang',     basic: false,           pro: true },
  { label: 'Laporan PDF / Excel',    basic: false,           pro: true },
  { label: 'Scan nota',              basic: false,           pro: true },
  { label: 'Money IQ',               basic: false,           pro: true },
  { label: 'Tema font premium',      basic: '2 tema',        pro: 'Semua tema' },
  { label: 'Widget layar utama',     basic: false,           pro: true },
];

function Cell({ value }) {
  if (value === true)  return <span className="fc-check">✓</span>;
  if (value === false) return <span className="fc-cross">—</span>;
  return <span className="fc-text">{value}</span>;
}

export function FeatureComparison({ onSelectPlan, defaultPlan = 'annual' }) {
  const [selected, setSelected] = useState(defaultPlan);
  const active = PLANS.find(p => p.id === selected);

  return (
    <div className="fc-wrap">
      <div className="fc-tabs">
        {PLANS.map(p => (
          <button
            key={p.id}
            className={`fc-tab${selected === p.id ? ' fc-tab--active' : ''}`}
            onClick={() => setSelected(p.id)}
          >
            {p.label}
            {p.savePercent && (
              <span className="fc-tab-badge">-{p.savePercent}%</span>
            )}
          </button>
        ))}
      </div>

      <div className="fc-price-box">
        <span className="fc-price serif">Rp {active.price.toLocaleString('id-ID')}</span>
        <span className="fc-period">{active.period}</span>
        {active.perMonth !== active.price && (
          <span className="fc-per-month">
            ≈ Rp {active.perMonth.toLocaleString('id-ID')}/bln
          </span>
        )}
      </div>

      <table className="fc-table">
        <thead>
          <tr>
            <th className="fc-th fc-th-feat">Fitur</th>
            <th className="fc-th fc-th-tier">Basic</th>
            <th className="fc-th fc-th-tier fc-pro-col">Pro</th>
          </tr>
        </thead>
        <tbody>
          {FEATURES.map(f => (
            <tr key={f.label}>
              <td className="fc-td fc-td-label">{f.label}</td>
              <td className="fc-td fc-td-val"><Cell value={f.basic} /></td>
              <td className="fc-td fc-td-val fc-pro-col"><Cell value={f.pro} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {onSelectPlan && (
        <button
          className="fc-cta"
          onClick={() => onSelectPlan(selected, active)}
        >
          Mulai Pro — Rp {active.price.toLocaleString('id-ID')}{active.period}
        </button>
      )}
    </div>
  );
}

export default FeatureComparison;
