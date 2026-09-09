import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from 'react-i18next';
import { fmt } from '../../data';
import { useScrollLock } from '../../hooks/useScrollLock';
import './UpgradeModal.css';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.Financeapp.app';

function getPricingPlans(t) {
  return [
    {
      id: 'monthly',
      label: t('subscription.compare.plan.monthly'),
      price: 30000,
      perMonth: 30000,
      period: t('subscription.upgrade.period.monthly'),
      savePercent: null,
    },
    {
      id: '6months',
      label: t('subscription.compare.plan.sixMonths'),
      price: 140000,
      perMonth: 23333,
      period: t('subscription.upgrade.period.sixMonths'),
      savePercent: 22,
    },
    {
      id: 'annual',
      label: t('subscription.compare.plan.annual'),
      price: 270000,
      perMonth: 22500,
      period: t('subscription.upgrade.period.annual'),
      savePercent: 25,
    },
  ];
}

export function UpgradeModal({ isOpen, onClose, reason, currentLimit, maxLimit, onSelectPlan, loading = false }) {
  const { t } = useTranslation();
  const [selectedPlan, setSelectedPlan] = useState('annual');
  useScrollLock(!!isOpen);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const PRICING_PLANS = getPricingPlans(t);

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
          <button className="um-close" onClick={onClose} aria-label={t('umum.tutup')}>✕</button>

          <div className="um-header">
            <div className="um-icon">👑</div>
            <h2 className="um-title serif">{t('subscription.upgrade.title')}</h2>
          </div>

          <div className="um-reason">
            <p>{t('subscription.upgrade.webOnlyDesc')}</p>
          </div>

          <div className="um-actions">
            <a
              className="um-btn-primary"
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', boxSizing: 'border-box', textAlign: 'center', textDecoration: 'none' }}
            >
              {t('subscription.upgrade.downloadPlayStore')}
            </a>
            <button className="um-btn-secondary" onClick={onClose}>
              {t('subscription.upgrade.later')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="um-overlay" onClick={onClose}>
      <div className="um-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="um-close" onClick={onClose} aria-label={t('umum.tutup')}>✕</button>

        <div className="um-header">
          <div className="um-icon">👑</div>
          <h2 className="um-title serif">{t('subscription.upgrade.title')}</h2>
        </div>

        {reason && (
          <div className="um-reason">
            <p>{reason}</p>
            {currentLimit != null && maxLimit != null && (
              <p className="um-limit">{t('subscription.upgrade.limitUsed', { currentLimit, maxLimit })}</p>
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
                    <span className="um-plan-badge">{t('subscription.upgrade.saveBadge', { percent: plan.savePercent })}</span>
                  )}
                </div>
                <div className="um-plan-price-row">
                  <span className="um-plan-price">
                    {fmt(plan.price)}
                  </span>
                  <span className="um-plan-period">{plan.period}</span>
                </div>
                {plan.perMonth !== plan.price && (
                  <div className="um-plan-monthly">
                    {t('subscription.upgrade.perMonthApprox', { price: fmt(plan.perMonth) })}
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="um-actions">
          <button className="um-btn-primary" onClick={handleUpgrade} disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? t('subscription.upgrade.processing') : t('subscription.upgrade.confirm')}
          </button>
          <button className="um-btn-secondary" onClick={onClose} disabled={loading}>
            {t('subscription.upgrade.later')}
          </button>
        </div>

        <p className="um-terms">
          {t('subscription.upgrade.terms')}
        </p>
      </div>
    </div>
  );
}

export default UpgradeModal;
