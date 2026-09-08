import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmt } from '../../data';
import './FeatureComparison.css';

function getPlans(t) {
  return [
    { id: 'monthly', label: t('subscription.compare.plan.monthly'), price: 30000,  perMonth: 30000, period: t('subscription.compare.period.monthly'),  savePercent: null },
    { id: '6months', label: t('subscription.compare.plan.sixMonths'), price: 140000, perMonth: 23333, period: t('subscription.compare.period.sixMonths'), savePercent: 22 },
    { id: 'annual',  label: t('subscription.compare.plan.annual'),   price: 270000, perMonth: 22500, period: t('subscription.compare.period.annual'),   savePercent: 25 },
  ];
}

function getFeatures(t) {
  const unlimited = t('subscription.compare.unlimited');
  return [
    { label: t('subscription.compare.feature.transaksi.label'),       basic: t('subscription.compare.feature.transaksi.basic'),       pro: unlimited },
    { label: t('subscription.compare.feature.kustomKategori.label'),  basic: t('subscription.compare.feature.kustomKategori.basic'),  pro: unlimited },
    { label: t('subscription.compare.feature.dompet.label'),          basic: t('subscription.compare.feature.dompet.basic'),          pro: unlimited },
    { label: t('subscription.compare.feature.goalsTabungan.label'),   basic: t('subscription.compare.feature.goalsTabungan.basic'),   pro: unlimited },
    { label: t('subscription.compare.feature.anggaran.label'),        basic: t('subscription.compare.feature.anggaran.basic'),        pro: unlimited },
    { label: t('subscription.compare.feature.hutangPiutang.label'),   basic: t('subscription.compare.feature.hutangPiutang.basic'),   pro: unlimited },
    { label: t('subscription.compare.feature.transaksiBerulang.label'), basic: false, pro: true },
    { label: t('subscription.compare.feature.laporanPdfExcel.label'), basic: t('subscription.compare.feature.laporanPdfExcel.basic'), pro: true },
    { label: t('subscription.compare.feature.scanNota.label'),        basic: false, pro: true },
    { label: t('subscription.compare.feature.moneyIq.label'),         basic: false, pro: true },
    { label: t('subscription.compare.feature.temaFontPremium.label'), basic: t('subscription.compare.feature.temaFontPremium.basic'), pro: t('subscription.compare.feature.temaFontPremium.pro') },
    { label: t('subscription.compare.feature.widgetLayarUtama.label'), basic: false, pro: true },
  ];
}

function Cell({ value }) {
  if (value === true)  return <span className="fc-check">✓</span>;
  if (value === false) return <span className="fc-cross">—</span>;
  return <span className="fc-text">{value}</span>;
}

export function FeatureComparison({ onSelectPlan, defaultPlan = 'annual' }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(defaultPlan);
  const PLANS = getPlans(t);
  const FEATURES = getFeatures(t);
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
        <span className="fc-price serif">{fmt(active.price)}</span>
        <span className="fc-period">{active.period}</span>
        {active.perMonth !== active.price && (
          <span className="fc-per-month">
            {t('subscription.compare.perMonthApprox', { price: fmt(active.perMonth) })}
          </span>
        )}
      </div>

      <table className="fc-table">
        <thead>
          <tr>
            <th className="fc-th fc-th-feat">{t('subscription.compare.table.feature')}</th>
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
          {t('subscription.compare.cta', { price: fmt(active.price), period: active.period })}
        </button>
      )}
    </div>
  );
}

export default FeatureComparison;
