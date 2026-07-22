import React from 'react';
import { supabase } from '../supabase';
import { useScrollLock } from '../hooks/useScrollLock';
import { CUSTOM_COLORS } from '../category-field';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function fmtDate(d) {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function EditCategoryModal({ open, category, userId, onClose }) {
  useScrollLock(open);

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('expense');
  const [color, setColor] = React.useState(CUSTOM_COLORS[0]);
  const [cooldown, setCooldown] = React.useState(null); // null = loading, { isOnCooldown, daysRemaining, nextEditDate }
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState('');

  React.useEffect(() => {
    if (!open || !userId) return;
    setName(category?.label || '');
    setType(category?.type || 'expense');
    setColor(category?.color || CUSTOM_COLORS[0]);
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
      .update({ name: cleanName, type, color })
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
    setToast(`Kategori berhasil diubah. Edit berikutnya bisa dilakukan setelah ${fmtDate(nextDate)}.`);
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
          Edit Kategori
        </div>
        <div className="serif" style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 20, letterSpacing: '-0.01em' }}>
          Ubah &ldquo;{category.label}&rdquo;
        </div>

        {/* Cooldown state */}
        {cooldown === null && (
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>Memeriksa…</div>
        )}

        {cooldown?.isOnCooldown && (
          <div>
            <div style={{
              fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)',
              background: 'color-mix(in oklch, var(--gold) 12%, var(--paper))',
              border: '1px solid color-mix(in oklch, var(--gold) 30%, transparent)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 20,
            }}>
              Anda sudah edit kategori pada <strong>{fmtDate(cooldown.lastEditDate)}</strong>.<br />
              Coba lagi setelah <strong>{cooldown.daysRemaining} hari</strong> ({fmtDate(cooldown.nextEditDate)}).<br /><br />
              Butuh fleksibilitas lebih? Upgrade ke Pro untuk hapus &amp; buat kategori unlimited.
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
                Mengerti
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
              ⚠ Edit kategori punya cooldown 1 bulan setelah perubahan.
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Nama Kategori
                </span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama kategori"
                  style={inputStyle}
                />
              </div>

              <div>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Jenis
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['expense', 'income'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit',
                        cursor: 'pointer', border: type === t ? '2px solid var(--ink)' : '1px solid var(--line-soft)',
                        background: type === t ? 'var(--ivory)' : 'var(--paper)',
                        color: type === t ? 'var(--ink)' : 'var(--muted)',
                        fontWeight: type === t ? 600 : 400,
                      }}
                    >
                      {t === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Warna
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CUSTOM_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setColor(col)}
                      style={{
                        width: 26, height: 26, borderRadius: '50%', background: col, cursor: 'pointer',
                        border: color === col ? '2px solid var(--ink)' : '2px solid transparent',
                        outline: color === col ? '2px solid var(--ivory)' : 'none',
                        outlineOffset: '-4px',
                      }}
                    />
                  ))}
                </div>
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
                Batal
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
                {loading ? 'Menyimpan…' : 'Confirm Edit'}
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
