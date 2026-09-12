import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconClose } from '../../icons';
import { useWalletMembers } from '../../hooks/useWalletMembers';
import InviteStatusBadge from './InviteStatusBadge';
import { memberErrorKey } from './memberErrors';

const PERAN_WARNA = {
  owner:  { fg: 'var(--sage)',  bg: 'rgba(92,107,76,.14)' },
  editor: { fg: '#2A6FDB',      bg: 'rgba(42,111,219,.14)' },
  viewer: { fg: 'var(--muted)', bg: 'var(--paper)' },
};

function PeranBadge({ role, t }) {
  const c = PERAN_WARNA[role] || PERAN_WARNA.viewer;
  return (
    <span style={{ fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: c.fg, background: c.bg, flexShrink: 0 }}>
      {t(`dompetBersama.peran.${role}`, { defaultValue: role })}
    </span>
  );
}

/**
 * Sheet kelola anggota sebuah dompet bersama.
 *
 * Dua wajah, tergantung siapa yang membuka:
 *   OWNER  → panel kode undangan di atas + tombol "Keluarkan" di tiap anggota.
 *   ANGGOTA→ hanya daftar (tahu siapa saja yang bisa melihat catatan yang sama)
 *            + tombol "Keluar dari dompet" untuk dirinya sendiri.
 *
 * Daftar hanya memuat anggota berstatus AKTIF — baris 'left' disimpan di DB
 * untuk riwayat, bukan untuk ditampilkan (list_wallet_members sudah menyaringnya
 * di server, jadi tidak perlu disaring lagi di sini).
 *
 * @param {object}   wallet    dompet format app (butuh id, name, isShared, role)
 * @param {string}   userId    user yang sedang login
 * @param {boolean}  canInvite owner DAN Pro
 * @param {() => void} onClose
 * @param {() => void} [onNeedPro]
 * @param {(pesan: string) => void} [onToast]
 * @param {() => void} [onLeft] dipanggil setelah user keluar dari dompet ini
 */
export default function MemberListSheet({ wallet, userId, canInvite, onClose, onNeedPro, onToast, onLeft }) {
  const { t } = useTranslation();
  const {
    members, membersLoading, membersError, busy,
    generateInviteCode, leaveWallet, removeMember,
  } = useWalletMembers(wallet?.id || null);

  const [error, setError] = React.useState(null);
  const [konfirmasiKeluar, setKonfirmasiKeluar] = React.useState(false);

  const isOwner = !wallet?.isShared;

  const keluar = async () => {
    setError(null);
    const res = await leaveWallet(wallet.id);
    if (!res.ok) { setError(t(memberErrorKey(res.reason))); return; }
    onToast?.(t('dompetBersama.toast.sudahKeluar', { nama: wallet.name }));
    onLeft?.();
    onClose();
  };

  const keluarkan = async (m) => {
    setError(null);
    const res = await removeMember(wallet.id, m.userId);
    if (!res.ok) { setError(t(memberErrorKey(res.reason))); return; }
    onToast?.(t('dompetBersama.toast.anggotaDikeluarkan', { nama: m.displayName || m.email }));
    // Daftar disegarkan oleh removeMember sendiri + realtime; tidak perlu
    // menambal state di sini.
  };

  // Anggota selain owner. Owner ikut ada di `members` sebagai baris sintetis
  // (is_owner), ditampilkan tapi tidak pernah bisa dikeluarkan.
  const jumlahAnggota = members.filter(m => !m.isOwner).length;

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(42,44,32,.45)', zIndex: 150 }} />
      <div role="dialog" aria-modal="true"
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '86vh', overflowY: 'auto', background: 'var(--ivory)', borderRadius: '16px 16px 0 0', padding: '24px 20px 40px', zIndex: 200, boxShadow: '0 -8px 32px -8px rgba(42,44,32,.2)', animation: 'rise .25s ease-out' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--line)', margin: '-12px auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.01em' }}>
              {t('dompetBersama.daftar.judul')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
              {wallet?.name} · {t('dompetBersama.daftar.jumlahAnggota', { count: jumlahAnggota })}
            </div>
          </div>
          <button onClick={onClose} aria-label={t('umum.tutup')}
            style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--paper)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>
            <IconClose size={14} />
          </button>
        </div>

        {isOwner && (
          <InviteStatusBadge
            walletId={wallet.id}
            canInvite={canInvite}
            onGenerate={generateInviteCode}
            generating={busy.generating}
            onNeedPro={onNeedPro}
          />
        )}

        {membersLoading && members.length === 0 ? (
          // Skeleton, bukan spinner: tinggi barisnya sama dengan daftar
          // sungguhan, jadi isinya tidak melompat saat data datang.
          <div>
            {[0, 1].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--paper)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 11, width: '52%', background: 'var(--paper)', borderRadius: 4 }} />
                  <div style={{ height: 9, width: '34%', background: 'var(--paper)', borderRadius: 4, marginTop: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : membersError ? (
          <div style={{ fontSize: 12.5, color: 'var(--terra)', lineHeight: 1.5, padding: '8px 0' }}>
            {t('dompetBersama.daftar.gagalMuat')}
          </div>
        ) : (
          <div>
            {members.map(m => {
              const sayaSendiri = m.userId === userId;
              const bisaDikeluarkan = isOwner && !m.isOwner;
              const sedangDikeluarkan = busy.removingUserId === m.userId;
              return (
                <div key={m.userId}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--paper)', border: '1px solid var(--line-soft)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', flexShrink: 0, textTransform: 'uppercase' }}>
                    {(m.displayName || m.email || '?').charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.displayName || m.email}
                      {sayaSendiri && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {t('dompetBersama.daftar.kamu')}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.email}
                    </div>
                  </div>
                  <PeranBadge role={m.role} t={t} />
                  {bisaDikeluarkan && (
                    <button onClick={() => keluarkan(m)} disabled={sedangDikeluarkan}
                      style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--paper)', color: 'var(--terra)', fontSize: 11.5, fontFamily: 'inherit', flexShrink: 0, opacity: sedangDikeluarkan ? 0.5 : 1 }}>
                      {sedangDikeluarkan ? t('umum.menyimpan') : t('dompetBersama.daftar.keluarkan')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginTop: 14, background: 'color-mix(in oklch, var(--terra) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--terra) 34%, transparent)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {/* Keluar dari dompet: hanya untuk ANGGOTA. Owner tidak punya baris di
            wallet_members, jadi leave_wallet selalu menolaknya — tombolnya
            memang tidak boleh ada. Owner yang ingin berhenti berbagi
            mengeluarkan anggotanya satu per satu. */}
        {!isOwner && (
          <div style={{ marginTop: 18 }}>
            {!konfirmasiKeluar ? (
              <button onClick={() => setKonfirmasiKeluar(true)}
                style={{ width: '100%', padding: '12px', background: 'var(--paper)', border: '1px solid color-mix(in oklch, var(--terra) 34%, transparent)', borderRadius: 12, fontSize: 13.5, color: 'var(--terra)', fontFamily: 'inherit' }}>
                {t('dompetBersama.daftar.keluarDompet')}
              </button>
            ) : (
              <div style={{ background: 'color-mix(in oklch, var(--terra) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--terra) 24%, transparent)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 10 }}>
                  {t('dompetBersama.daftar.keluarKonfirmasi')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setKonfirmasiKeluar(false)}
                    style={{ flex: 1, padding: '10px', background: 'var(--ivory)', border: '1px solid var(--line-soft)', borderRadius: 10, fontSize: 12.5, color: 'var(--ink-2)', fontFamily: 'inherit' }}>
                    {t('umum.batal')}
                  </button>
                  <button onClick={keluar} disabled={busy.leaving}
                    style={{ flex: 1, padding: '10px', background: 'var(--terra)', color: '#fff', border: 0, borderRadius: 10, fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', opacity: busy.leaving ? 0.6 : 1 }}>
                    {busy.leaving ? t('umum.menyimpan') : t('dompetBersama.daftar.keluarYa')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
