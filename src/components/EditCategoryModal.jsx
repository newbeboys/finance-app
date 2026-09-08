import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { useScrollLock } from '../hooks/useScrollLock';
import { CUSTOM_COLORS } from '../category-field';
import { CatIcon, DEFAULT_CATEGORY_ICON } from '../icons';
import { IconColorPicker } from './IconColorPicker';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function fmtDate(d) {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function EditCategoryModal({ open, category, userId, onClose }) {
  const { t } = useTranslation();
  useScrollLock(open);

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('expense');
  const [color, setColor] = React.useState(CUSTOM_COLORS[0]);
  const [icon, setIcon] = React.useState(DEFAULT_CATEGORY_ICON);
  const [cooldown, setCooldown] = React.useState(null); // null = loading, { isOnCooldown, daysRemaining, nextEditDate }
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const [pickerOpen, setPickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open || !userId) return;
    setName(category?.label || '');
    setType(category?.type || 'expense');
    setColor(category?.color || CUSTOM_COLORS[0]);
    setIcon(category?.icon || DEFAULT_CATEGORY_ICON);
    setCooldown(null);
    setToast('');

    supabase
      .from('user_subscriptions')
      .select('last_custom_category_edit_at')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        const lastAt = data?.last_custom_category_edit_at;
        if (!lastAt) { setCooldown({ isOnCooldown: false }); return; }
        const days = (Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24);
        if (days < 30) {
          setCooldown({
            isOnCooldown: true,
            daysRemaining: Math.ceil(30 - days),
            nextEditDate: new Date(new Date(lastAt).getTime() + 30 * 24 * 60 * 60 * 1000),
            lastEditDate: new Date(lastAt),
          });
        } else {
          setCooldown({ isOnCooldown: false });
        }
      });
  }, [open, userId, category]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !category) return null;

  const handleConfirm = async () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    setLoading(true);

    // Re-check cooldown before writing (fresh fetch)
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('last_custom_category_edit_at')
      .eq('user_id', userId)
      .maybeSingle();

    const lastAt = sub?.last_custom_category_edit_at;
    if (lastAt) {
      const days = (Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24);
      if (days < 30) {
        const daysLeft = Math.ceil(30 - days);
        const nextDate = new Date(new Date(lastAt).getTime() + 30 * 24 * 60 * 60 * 1000);
        setCooldown({ isOnCooldown: true, daysRemaining: daysLeft, nextEditDate: nextDate, lastEditDate: new Date(lastAt) });
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase
      .from('custom_categories')
      .update({ name: cleanName, type, color, icon })
      .eq('id', category.id)
      .eq('user_id', userId);

    if (error) {
      setLoading(false);
      return;
    }

    const { error: cooldownError } = await supabase.rpc('update_category_edit_cooldown', {
      p_user_id: userId
    });

    if (cooldownError) {
      console.error('Gagal update cooldown:', cooldownError);
      // Tetap lanjutkan flow sukses edit kategori, tapi log error untuk debugging
      // (cooldown tracking gagal tidak boleh blokir user dari fitur edit yang sudah terjadi)
    }

    const nextDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setToast(t('category.edit.successToast', { date: fmtDate(nextDate) }));
    setLoading(false);

    setTimeout(() => {
      setToast('');
      onClose();
    }, 2200);
  };

  const inputStyle = {
    width: '100%', padding: '11px 12px', background: 'var(--paper)',
    border: '1px solid var(--line-soft)', borderRadius: 10, color: 'var(--ink)',
    fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 5100,
        background: 'rgba(42,44,32,.45)', backdropFilter: 'blur(4px)',
        padding: 24,
        animation: 'rise .2s ease-out',
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(380px, 100%)', padding: 28,
          animation: 'rise .25s ease-out',
          boxShadow: '0 30px 80px -20px rgba(42,44,32,.5)',
          maxHeight: 'calc(100dvh - 48px)',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {t('category.edit.eyebrow')}
        </div>
        <div className="serif" style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 20, letterSpacing: '-0.01em' }}>
          {t('category.edit.confirmTitle', { label: category.label })}
        </div>

        {/* Cooldown state */}
        {cooldown === null && (
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>{t('category.edit.checking')}</div>
        )}

        {cooldown?.isOnCooldown && (
          <div>
            <div style={{
              fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)',
              background: 'color-mix(in oklch, var(--gold) 12%, var(--paper))',
              border: '1px solid color-mix(in oklch, var(--gold) 30%, transparent)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 20,
            }}>
              {t('category.edit.cooldownNotice.editedOn')} <strong>{fmtDate(cooldown.lastEditDate)}</strong>.<br />
              {t('category.edit.cooldownNotice.retryAfter')} <strong>{t('category.edit.cooldownNotice.daysRemaining', { count: cooldown.daysRemaining })}</strong> ({fmtDate(cooldown.nextEditDate)}).<br /><br />
              {t('category.edit.cooldownNotice.upgradeHint')}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '13px', background: 'var(--paper)',
                  border: '1px solid var(--line-soft)', borderRadius: 12,
                  fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {t('category.edit.understood')}
              </button>
            </div>
          </div>
        )}

        {cooldown && !cooldown.isOnCooldown && !toast && (
          <div>
            <div style={{
              fontSize: 12.5, color: 'var(--gold)', lineHeight: 1.5,
              background: 'color-mix(in oklch, var(--gold) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--gold) 25%, transparent)',
              borderRadius: 8, padding: '8px 12px', marginBottom: 16,
            }}>
              {t('category.edit.cooldownHint')}
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {t('category.edit.nameLabel')}
                </span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('category.edit.namePlaceholder')}
                  style={inputStyle}
                />
              </div>

              <div>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {t('category.edit.typeLabel')}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['expense', 'income'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setType(opt)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit',
                        cursor: 'pointer', border: type === opt ? '2px solid var(--ink)' : '1px solid var(--line-soft)',
                        background: type === opt ? 'var(--ivory)' : 'var(--paper)',
                        color: type === opt ? 'var(--ink)' : 'var(--muted)',
                        fontWeight: type === opt ? 600 : 400,
                      }}
                    >
                      {opt === 'expense' ? t('transaksi.pengeluaran') : t('transaksi.pemasukan')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {t('category.edit.iconColorLabel')}
                </span>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content',
                    padding: '6px 14px 6px 6px', borderRadius: 10, cursor: 'pointer',
                    border: '1px solid var(--line-soft)', background: 'var(--paper)',
                    fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)',
                  }}
                >
                  <span style={{
                    width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0,
                    background: `color-mix(in oklch, ${color} 18%, var(--paper))`, color,
                  }}>
                    <CatIcon kind={icon} size={14} />
                  </span>
                  {t('kategori.ikonWarnaDipilih')}
                </button>

                <IconColorPicker
                  isOpen={pickerOpen}
                  onClose={() => setPickerOpen(false)}
                  onConfirm={(nextIcon, nextColor) => { setIcon(nextIcon); setColor(nextColor); }}
                  initialIcon={icon}
                  initialColor={color}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={onClose}
                disabled={loading}
                style={{
                  flex: 1, padding: '13px', background: 'var(--paper)',
                  border: '1px solid var(--line-soft)', borderRadius: 12,
                  fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {t('umum.batal')}
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || !name.trim()}
                style={{
                  flex: 2, padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 500,
                  fontFamily: 'inherit', border: 0, cursor: (loading || !name.trim()) ? 'default' : 'pointer',
                  background: (loading || !name.trim()) ? 'var(--line-soft)' : 'var(--ink)',
                  color: (loading || !name.trim()) ? 'var(--muted-2)' : 'var(--cream)',
                }}
              >
                {loading ? t('umum.menyimpan') : t('category.edit.confirmButton')}
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div style={{
            fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55, textAlign: 'center', padding: '8px 0',
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
