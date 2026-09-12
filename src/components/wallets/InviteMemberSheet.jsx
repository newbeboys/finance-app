import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconClose, IconCheck } from '../../icons';
import { useWalletMembers } from '../../hooks/useWalletMembers';
import { memberErrorKey, minutesUntil } from './memberErrors';

/**
 * Sheet "Gabung Dompet Bersama" — user memasukkan kode undangan 6 digit.
 *
 * CATATAN NAMA: file ini bernama InviteMemberSheet mengikuti penamaan di
 * rencana Task 4, tapi isinya adalah sisi PENERIMA undangan (accept), bukan
 * sisi pengundang. Sisi pengundang ada di InviteStatusBadge (buat & tampilkan
 * kode) yang dipasang di dalam MemberListSheet.
 *
 * Terbuka untuk SEMUA plan, termasuk Basic. Yang digerbangi Pro hanyalah
 * MENGUNDANG (generate_wallet_invite); menerima undangan tidak — kalau
 * penerima juga harus Pro, dompet bersama tidak akan pernah terpakai.
 *
 * @param {() => void} onClose
 * @param {(walletId: string) => void} [onJoined] dipanggil setelah berhasil
 *   bergabung. Daftar dompet menyegarkan dirinya sendiri lewat realtime
 *   `wallet_members` di useWallets, jadi callback ini untuk toast/navigasi saja.
 */
export default function InviteMemberSheet({ onClose, onJoined }) {
  const { t } = useTranslation();
  // walletId null: sheet ini tidak menampilkan daftar anggota, hanya memakai
  // aksi acceptInviteCode. Hook tidak akan fetch/subscribe apa pun.
  const { acceptInviteCode, busy } = useWalletMembers(null);

  const [code, setCode]   = React.useState('');
  const [error, setError] = React.useState(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  // Hanya angka, maksimal 6. Disaring saat mengetik supaya user tidak baru
  // tahu formatnya salah setelah menekan tombol.
  const onChange = (e) => {
    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
    if (error) setError(null);
  };

  const submit = async () => {
    if (busy.accepting) return;
    setError(null);
    const res = await acceptInviteCode(code);
    if (res.ok) {
      onJoined?.(res.data?.walletId);
      onClose();
      return;
    }
    // rate_limited membawa reset_at; menitnya dihitung hanya untuk ditampilkan.
    const menit = res.reason === 'rate_limited' ? minutesUntil(res.data?.resetAt) : null;
    setError(t(memberErrorKey(res.reason), { count: menit ?? 0, menit: menit ?? 0 }));
  };

  const bisaKirim = /^\d{6}$/.test(code) && !busy.accepting;

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(42,44,32,.45)', zIndex: 150 }} />
      <div role="dialog" aria-modal="true"
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ivory)', borderRadius: '16px 16px 0 0', padding: '24px 20px 40px', zIndex: 200, boxShadow: '0 -8px 32px -8px rgba(42,44,32,.2)', animation: 'rise .25s ease-out' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--line)', margin: '-12px auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.01em' }}>
              {t('dompetBersama.gabung.judul')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3, lineHeight: 1.45 }}>
              {t('dompetBersama.gabung.deskripsi')}
            </div>
          </div>
          <button onClick={onClose} aria-label={t('umum.tutup')}
            style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--paper)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>
            <IconClose size={14} />
          </button>
        </div>

        {/* type="text" + inputMode="numeric", BUKAN type="number": number
            memunculkan tombol spinner, menerima "e"/"+"/"-", dan memotong nol
            di depan — padahal kode 6 digit bisa dimulai dengan 0 (lpad di
            generate_wallet_invite). Juga BUKAN type="password": kode ini
            memang dibagikan, dan menyembunyikannya hanya menyulitkan user
            memeriksa ketikannya. */}
        <label style={{ display: 'block' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
            {t('dompetBersama.gabung.labelKode')}
          </span>
          <input
            ref={inputRef}
            value={code}
            onChange={onChange}
            onKeyDown={(e) => { if (e.key === 'Enter' && bisaKirim) submit(); }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-invalid={!!error}
            style={{ width: '100%', padding: '14px 12px', background: 'var(--paper)', border: `1px solid ${error ? 'var(--terra)' : 'var(--line-soft)'}`, borderRadius: 10, color: 'var(--ink)', fontSize: 26, fontFamily: 'inherit', letterSpacing: '.34em', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
            className="tnum"
          />
        </label>

        {error && (
          <div role="alert" style={{ marginTop: 12, background: 'color-mix(in oklch, var(--terra) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--terra) 34%, transparent)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '13px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, fontSize: 14, color: 'var(--ink-2)', fontFamily: 'inherit' }}>
            {t('umum.batal')}
          </button>
          {/* Sengaja TIDAK ada modal konfirmasi setelah ini: user sudah
              mengetik kode dengan sengaja, konfirmasi kedua hanya menambah
              langkah tanpa mencegah kesalahan apa pun. */}
          <button onClick={submit} disabled={!bisaKirim}
            style={{ flex: 1, padding: '13px', background: 'var(--ink)', color: 'var(--cream)', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: bisaKirim ? 1 : 0.5, cursor: bisaKirim ? 'pointer' : 'not-allowed' }}>
            {busy.accepting
              ? t('umum.menyimpan')
              : <><IconCheck size={14} /> {t('dompetBersama.gabung.tombol')}</>}
          </button>
        </div>
      </div>
    </>
  );
}
