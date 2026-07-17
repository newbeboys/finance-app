import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useScrollLock } from '../../hooks/useScrollLock';
import './UpgradeModal.css';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.Financeapp.app';

const PRICING_PLANS = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: 30000,
    perMonth: 30000,
    period: '/bulan',
    savePercent: null,
  },
  {
    id: '6months',
    label: '6 Bulan',
    price: 140000,
    perMonth: 23333,
    period: '/6 bulan',
    savePercent: 22,
  },
  {
    id: 'annual',
    label: 'Tahunan',
    price: 270000,
    perMonth: 22500,
    period: '/tahun',
    savePercent: 25,
  },
];

export function UpgradeModal({ isOpen, onClose, reason, currentLimit, maxLimit, onSelectPlan, loading = false }) {
  const [selectedPlan, setSelectedPlan] = useState('annual');
  useScrollLock(!!isOpen);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleUpgrade = () => {
    const plan = PRICING_PLANS.find(p => p.id === selectedPlan);
    onSelectPlan?.(selectedPlan, plan);
  };

  // Web tidak punya jalur pembayaran (RevenueCat = Android-only). Jangan tampilkan
  // pemilihan paket/tombol beli sama sekali — arahkan ke Play Store.
  if (!Capacitor.isNativePlatform()) {
    return (
      <div className="um-overlay" onClick={onClose}>
        <div className="um-sheet" onClick={(e) => e.stopPropagation()}>
          <button className="um-close" onClick={onClose} aria-label="Tutup">✕</button>

          <div className="um-header">
            <div className="um-icon">👑</div>
            <h2 className="um-title serif">Upgrade ke Pro</h2>
          </div>

          <div className="um-reason">
            <p>Upgrade ke Pro saat ini hanya tersedia lewat aplikasi Android.</p>
          </div>

          <div className="um-actions">
            <a
              className="um-btn-primary"
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', boxSizing: 'border-box', textAlign: 'center', textDecoration: 'none' }}
            >
              Download di Play Store
            </a>
            <button className="um-btn-secondary" onClick={onClose}>
              Nanti Saja
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="um-overlay" onClick={onClose}>
      <div className="um-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="um-close" onClick={onClose} aria-label="Tutup">✕</button>

        <div className="um-header">
          <div className="um-icon">👑</div>
          <h2 className="um-title serif">Upgrade ke Pro</h2>
        </div>

        {reason && (
          <div className="um-reason">
            <p>{reason}</p>
            {currentLimit != null && maxLimit != null && (
              <p className="um-limit">{currentLimit}/{maxLimit} terpakai</p>
            )}
          </div>
        )}

        <div className="um-plans">
          {PRICING_PLANS.map((plan) => (
            <label
              key={plan.id}
              className={`um-plan${selectedPlan === plan.id ? ' um-plan--active' : ''}`}
            >
              <input
                type="radio"
                name="um-plan"
                value={plan.id}
                checked={selectedPlan === plan.id}
                onChange={(e) => setSelectedPlan(e.target.value)}
              />
              <div className="um-plan-body">
                <div className="um-plan-top">
                  <span className="um-plan-label">{plan.label}</span>
                  {plan.savePercent && (
                    <span className="um-plan-badge">HEMAT {plan.savePercent}%</span>
                  )}
                </div>
                <div className="um-plan-price-row">
                  <span className="um-plan-price">
                    Rp {plan.price.toLocaleString('id-ID')}
                  </span>
                  <span className="um-plan-period">{plan.period}</span>
                </div>
                {plan.perMonth !== plan.price && (
                  <div className="um-plan-monthly">
                    ≈ Rp {plan.perMonth.toLocaleString('id-ID')}/bulan
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="um-actions">
          <button className="um-btn-primary" onClick={handleUpgrade} disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Memproses...' : 'Upgrade Sekarang'}
          </button>
          <button className="um-btn-secondary" onClick={onClose} disabled={loading}>
            Nanti Saja
          </button>
        </div>

        <p className="um-terms">
          Perpanjang otomatis sesuai plan. Batalkan kapan saja di Settings.
        </p>
      </div>
    </div>
  );
}

export default UpgradeModal;
