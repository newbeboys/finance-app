import React from 'react';
import { useTranslation } from 'react-i18next';
import { fmt } from '../../data';
import './SubscriptionStatus.css';

export function SubscriptionStatus({
  isPro,
  billingCycle,
  expiresAt,
  onUpgrade,
  onManage,
  onCancel,
}) {
  const { t, i18n } = useTranslation();
  const BILLING_LABELS = {
    monthly:   t('subscription.status.billing.monthly',   { price: fmt(30000) }),
    '6months': t('subscription.status.billing.sixMonths', { price: fmt(140000) }),
    annual:    t('subscription.status.billing.annual',    { price: fmt(270000) }),
  };
  const planLabel = BILLING_LABELS[billingCycle] || null;
  const billingDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'id-ID', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  return (
    <div data-tour="settings-akun-paket" className={`ss-card ${isPro ? 'ss-pro' : 'ss-basic'}`}>
      <div className="ss-header">
        <div className="ss-icon">{isPro ? '👑' : '🔒'}</div>
        <div className="ss-meta">
          <div className="ss-plan-name">{isPro ? 'Pro' : 'Basic'}</div>
          {isPro && planLabel && (
            <div className="ss-plan-detail">{planLabel}</div>
          )}
          {isPro && billingDate && (
            <div className="ss-billing">{t('subscription.status.renews', { date: billingDate })}</div>
          )}
        </div>
      </div>

      <p className="ss-desc">
        {isPro ? t('subscription.status.descPro') : t('subscription.status.descBasic')}
      </p>

      {!isPro && (
        <ul className="ss-pricing">
          <li>{t('subscription.status.pricing.monthly', { price: fmt(30000) })}</li>
          <li>
            {t('subscription.status.pricing.sixMonths', { price: fmt(140000) })}{' '}
            <span className="ss-save">{t('subscription.status.save', { percent: 22 })}</span>
          </li>
          <li>
            {t('subscription.status.pricing.annual', { price: fmt(270000) })}{' '}
            <span className="ss-save">{t('subscription.status.save', { percent: 25 })}</span>
          </li>
        </ul>
      )}

      <div className="ss-actions">
        {isPro ? (
          <>
            {onManage && (
              <button className="ss-btn ss-btn-outline" onClick={onManage}>
                {t('subscription.status.manage')}
              </button>
            )}
            {onCancel && (
              <button className="ss-btn ss-btn-danger" onClick={onCancel}>
                {t('subscription.status.cancel')}
              </button>
            )}
          </>
        ) : (
          <button className="ss-btn ss-btn-primary" onClick={onUpgrade}>
            {t('subscription.status.upgradeCta')}
          </button>
        )}
      </div>
    </div>
  );
}

export default SubscriptionStatus;
