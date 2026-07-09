import React from 'react';
import './SubscriptionStatus.css';

const BILLING_LABELS = {
  monthly:  'Monthly · Rp 30.000/bulan',
  '6months': '6-Month · Rp 140.000/6 bulan',
  annual:   'Tahunan · Rp 270.000/tahun',
};

export function SubscriptionStatus({
  isPro,
  billingCycle,
  expiresAt,
  onUpgrade,
  onManage,
  onCancel,
}) {
  const planLabel = BILLING_LABELS[billingCycle] || null;
  const billingDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('id-ID', {
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
            <div className="ss-billing">Perpanjang {billingDate}</div>
          )}
        </div>
      </div>

      <p className="ss-desc">
        {isPro
          ? 'Akses penuh: laporan PDF/Excel, scan nota, transaksi berulang, Money IQ, dan semua tema font.'
          : 'Beberapa fitur dibatasi. Upgrade ke Pro untuk akses tanpa batas.'}
      </p>

      {!isPro && (
        <ul className="ss-pricing">
          <li>Monthly — Rp 30.000/bulan</li>
          <li>6-Month — Rp 140.000 <span className="ss-save">hemat 22%</span></li>
          <li>Annual — Rp 270.000 <span className="ss-save">hemat 25%</span></li>
        </ul>
      )}

      <div className="ss-actions">
        {isPro ? (
          <>
            {onManage && (
              <button className="ss-btn ss-btn-outline" onClick={onManage}>
                Kelola Langganan
              </button>
            )}
            {onCancel && (
              <button className="ss-btn ss-btn-danger" onClick={onCancel}>
                Batalkan Langganan
              </button>
            )}
          </>
        ) : (
          <button className="ss-btn ss-btn-primary" onClick={onUpgrade}>
            Upgrade ke Pro
          </button>
        )}
      </div>
    </div>
  );
}

export default SubscriptionStatus;
