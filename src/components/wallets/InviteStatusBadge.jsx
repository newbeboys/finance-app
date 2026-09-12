import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconCheck } from '../../icons';
import { memberErrorKey } from './memberErrors';

// Sisa waktu kode dalam bentuk yang enak dibaca. Di bawah satu jam ditampilkan
// dalam menit — "kedaluwarsa dalam 0 jam" tidak memberi tahu apa pun.
function sisaWaktu(expiresAt, t) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const menit = Math.ceil(ms / 60000);
  return menit < 60
    ? t('dompetBersama.kode.sisaMenit', { count: menit })
    : t('dompetBersama.kode.sisaJam',   { count: Math.floor(menit / 60) });
}

/**
 * Panel kode undangan untuk OWNER: membuat kode 6 digit, menampilkannya
 * beserta sisa masa berlaku, dan membuat ulang bila perlu.
 *
 * Kode TIDAK dimuat saat panel dibuka. Tidak ada RPC "ambil kode aktif", dan
 * itu memang disengaja di Task 3: satu-satunya cara mendapatkan kode adalah
 * membuatnya, dan membuat kode baru otomatis me-revoke yang lama. Jadi panel
 * ini selalu mulai dari keadaan "belum ada kode di layar" — bukan berarti
 * tidak ada kode aktif di server, hanya berarti kode itu tidak pernah
 * ditampilkan dua kali.
 *
 * @param {string}  walletId
 * @param {boolean} canInvite  owner DAN plan Pro (limits.sharedWalletInviteEnabled)
 * @param {(walletId: string, role: string) => Promise<{ok, reason, data}>} onGenerate
 * @param {boolean} generating
 * @param {() => void} [onNeedPro] dipanggil saat user non-Pro menyentuh fitur ini
 */
export default function InviteStatusBadge({ walletId, canInvite, onGenerate, generating, onNeedPro }) {
  const { t } = useTranslation();
  const [invite, setInvite] = React.useState(null);   // { code, expiresAt }
  const [role, setRole]     = React.useState('editor');
  const [error, setError]   = React.useState(null);
  const [disalin, setDisalin] = React.useState(false);

  // Menit berjalan supaya "kedaluwarsa dalam N menit" tidak membeku di layar
  // selama sheet dibuka. Hanya hidup saat ada kode yang ditampilkan.
  const [, tick] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    if (!invite) return;
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [invite]);

  const buat = async () => {
    if (!canInvite) { onNeedPro?.(); return; }
    setError(null);
    const res = await onGenerate(walletId, role);
    if (!res.ok) { setError(t(memberErrorKey(res.reason))); return; }
    setInvite({ code: res.data.code, expiresAt: res.data.expiresAt });
    setDisalin(false);
  };

  const salin = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setDisalin(true);
      setTimeout(() => setDisalin(false), 2000);
    } catch {
      // Clipboard bisa ditolak (izin, konteks non-secure di WebView). Kodenya
      // tetap terbaca di layar, jadi kegagalan menyalin bukan kegagalan alur —
      // jangan tampilkan error, cukup jangan tampilkan konfirmasi "tersalin".
    }
  };

  const sisa = invite ? sisaWaktu(invite.expiresAt, t) : null;
  const kedaluwarsa = invite && !sisa;

  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
        {t('dompetBersama.kode.judul')}
      </div>

      {!invite ? (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 12 }}>
            {t('dompetBersama.kode.penjelasan')}
          </div>

          {/* Peran dipilih SEBELUM kode dibuat, karena peran menempel pada
              kodenya (wallet_invites.role) dan tidak bisa diubah setelah
              seseorang memakainya — mengubah peran anggota aktif sengaja tidak
              disediakan lewat jalur undangan (risiko privilege escalation,
              lihat catatan di migrasi 20260913000000). */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['editor', 'viewer'].map(r => (
              <button key={r} onClick={() => setRole(r)}
                style={{ flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer',
                  border: `1px solid ${role === r ? 'var(--sage)' : 'var(--line-soft)'}`,
                  background: role === r ? 'color-mix(in oklch, var(--sage) 14%, transparent)' : 'var(--ivory)',
                  color: role === r ? 'var(--sage)' : 'var(--ink-2)', fontWeight: role === r ? 600 : 400 }}>
                <div>{t(`dompetBersama.peran.${r}`)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, fontWeight: 400 }}>
                  {t(`dompetBersama.peran.${r}Desc`)}
                </div>
              </button>
            ))}
          </div>

          <button onClick={buat} disabled={generating}
            style={{ width: '100%', padding: '11px', background: 'var(--ink)', color: 'var(--cream)', border: 0, borderRadius: 10, fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: generating ? 0.6 : 1 }}>
            <IconPlus size={14} /> {generating ? t('umum.menyimpan') : t('dompetBersama.kode.buat')}
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="tnum serif" style={{ fontSize: 30, letterSpacing: '.2em', color: 'var(--ink)' }}>
              {invite.code}
            </div>
            <span style={{ fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600, padding: '3px 9px', borderRadius: 999,
              color: kedaluwarsa ? 'var(--muted)' : 'var(--sage)',
              background: kedaluwarsa ? 'var(--paper)' : 'rgba(92,107,76,.14)',
              border: kedaluwarsa ? '1px solid var(--line-soft)' : '0' }}>
              {kedaluwarsa ? t('dompetBersama.kode.kedaluwarsa') : t('dompetBersama.kode.aktif')}
            </span>
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
            {kedaluwarsa
              ? t('dompetBersama.kode.sudahLewat')
              : t('dompetBersama.kode.berlaku', { sisa, peran: t(`dompetBersama.peran.${role}`) })}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={salin} disabled={kedaluwarsa}
              style={{ flex: 1, padding: '10px', background: 'var(--ivory)', border: '1px solid var(--line-soft)', borderRadius: 10, fontSize: 12.5, color: 'var(--ink-2)', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: kedaluwarsa ? 0.5 : 1 }}>
              {disalin ? <><IconCheck size={13} /> {t('dompetBersama.kode.tersalin')}</> : t('dompetBersama.kode.salin')}
            </button>
            {/* Tidak ada RPC "revoke" terpisah — generate ulang sudah otomatis
                me-revoke kode lama (keputusan produk #2, migrasi 20260913000000). */}
            <button onClick={buat} disabled={generating}
              style={{ flex: 1, padding: '10px', background: 'var(--ivory)', border: '1px solid var(--line-soft)', borderRadius: 10, fontSize: 12.5, color: 'var(--ink-2)', fontFamily: 'inherit', opacity: generating ? 0.6 : 1 }}>
              {generating ? t('umum.menyimpan') : t('dompetBersama.kode.buatBaru')}
            </button>
          </div>
        </>
      )}

      {error && (
        <div role="alert" style={{ marginTop: 10, fontSize: 12, color: 'var(--terra)', lineHeight: 1.5 }}>
          {error}
        </div>
      )}
    </div>
  );
}
