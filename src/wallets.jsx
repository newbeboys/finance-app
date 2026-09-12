import React from 'react';
import { useTranslation } from 'react-i18next';
import { ACCOUNT_TYPES, ALL_CATEGORIES, fmtShort, fmt, formatNominal, nominalFontSize } from './data';
import { IconBudget, IconPlus, IconChev, IconClose, CatIcon } from './icons';
import { useScrollLock } from './hooks/useScrollLock';
import { LockBadge } from './components/PaywallModal';
import { resolveCategory, categoryLabel } from './category-field';
import MemberListSheet from './components/wallets/MemberListSheet';
import InviteMemberSheet from './components/wallets/InviteMemberSheet';

const WALLET_GLYPH = {
  bank:       <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 15h4" /></>,
  ewallet:    <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M16 12h.01" /><path d="M21 9h-5a3 3 0 0 0 0 6h5" /></>,
  cash:       <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  investment: <><path d="M4 17l5-6 4 3 7-9" /><path d="M14 5h6v6" /></>,
};

export function WalletGlyph({ type, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {WALLET_GLYPH[type] || WALLET_GLYPH.bank}
    </svg>
  );
}

// Label tipe dompet versi Bahasa Indonesia mentah dari ACCOUNT_TYPES.
// JANGAN dipakai untuk tampilan — pakai typeLabelI18n(). Fungsi ini khusus
// untuk nilai yang DISIMPAN ke database (kolom `institution`), yang harus
// stabil dan tidak ikut berubah mengikuti bahasa UI saat dompet dibuat.
const typeLabel = (id) => (ACCOUNT_TYPES.find(t => t.id === id) || {}).label || id;

// Label tipe dompet untuk TAMPILAN — mengikuti bahasa UI.
const TYPE_LABEL_KEY = {
  bank: 'dompet.rekeningBank', ewallet: 'dompet.eWallet',
  cash: 'dompet.tunai', investment: 'dompet.investasi',
};
const typeLabelI18n = (id, translate) =>
  translate(TYPE_LABEL_KEY[id] || '', { defaultValue: typeLabel(id) });

// `accounts` di sini adalah visibleAccounts (milik + bersama): pemilih ini
// dipakai untuk MEMFILTER tampilan, dan dompet bersama harus bisa dipilih (Q1).
//
// `totalBalance` sengaja diminta sebagai prop terpisah alih-alih dijumlah dari
// `accounts`: komponen ini satu-satunya tempat Q1 dan Q2 bertabrakan — daftarnya
// harus memuat dompet bersama, tapi angka "Semua dompet" TIDAK boleh (Q2: saldo
// orang lain bukan kekayaan user ini). Menjumlah dari `accounts` di sini akan
// menampilkan total yang berbeda dari KPI dashboard untuk data yang sama.
export function AccountSwitcher({ accounts, selected, onSelect, onAdd, addLocked = false, totalBalance = null }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  // ?? bukan ||: total 0 adalah nilai sah dan tidak boleh jatuh ke penjumlahan.
  const total = totalBalance ?? accounts.reduce((s, a) => s + a.balance, 0);
  const current = selected === "all" ? null : accounts.find(a => a.id === selected);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: "7px 12px", background: "var(--ivory)",
        border: "1px solid var(--line-soft)", borderRadius: 12,
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: current ? `color-mix(in oklch, ${current.color} 18%, var(--ivory))` : "var(--paper)",
          color: current ? current.color : "var(--ink)",
          display: "grid", placeItems: "center",
        }}>
          {current ? <WalletGlyph type={current.type} size={14} /> : <IconBudget size={14} />}
        </span>
        <span style={{ textAlign: "left", lineHeight: 1.15 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 500 }}>
            {current ? current.name : t('dompet.semuadompet')}
          </span>
          <span className="tnum" style={{ display: "block", fontSize: 10.5, color: "var(--muted)" }}>
            {fmtShort(current ? current.balance : total)}
          </span>
        </span>
        <IconChev size={14} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div className="card rise" style={{ position: "absolute", top: 50, right: 0, width: 300, zIndex: 31, padding: 8 }}>
            <button onClick={() => { onSelect("all"); setOpen(false); }} style={switcherRow(selected === "all")}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink)" }}>
                <IconBudget size={15} />
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{t('dompet.semuadompet')}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{t('dompet.dompetGabungan', { count: accounts.length })}</span>
              </span>
              <span className="tnum" style={{ fontSize: 12.5, fontWeight: 500 }}>{fmtShort(total)}</span>
            </button>
            <div style={{ height: 1, background: "var(--line-soft)", margin: "6px 4px" }} />
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {accounts.map(a => (
                <button key={a.id} onClick={() => { onSelect(a.id); setOpen(false); }} style={{ ...switcherRow(selected === a.id), opacity: a.is_locked ? 0.65 : 1 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in oklch, ${a.color} 18%, var(--ivory))`, color: a.color, display: "grid", placeItems: "center" }}>
                    <WalletGlyph type={a.type} size={15} />
                  </span>
                  <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}{a.is_locked ? " 🔒" : ""}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{typeLabelI18n(a.type, t)}{a.last4 !== "—" ? ` •• ${a.last4}` : ""}</span>
                  </span>
                  <span className="tnum" style={{ fontSize: 12.5 }}>{fmtShort(a.balance)}</span>
                </button>
              ))}
            </div>
            <div style={{ height: 1, background: "var(--line-soft)", margin: "6px 4px" }} />
            <button onClick={() => { setOpen(false); onAdd(); }} style={{
              position: "relative",
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 10px", borderRadius: 10, border: 0, background: "transparent",
              color: "var(--ink)", fontSize: 13, fontWeight: 500,
              opacity: addLocked ? 0.6 : 1, cursor: addLocked ? "not-allowed" : "pointer",
            }}>
              <span style={{ position: "relative", width: 30, height: 30, borderRadius: 8, background: "var(--ink)", color: "var(--cream)", display: "grid", placeItems: "center" }}>
                <IconPlus size={15} />
                {addLocked && <LockBadge />}
              </span>
              {t('dompet.tambahdompet')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const switcherRow = (active) => ({
  width: "100%", display: "flex", alignItems: "center", gap: 10,
  padding: "9px 10px", borderRadius: 10, border: 0,
  background: active ? "var(--paper)" : "transparent", cursor: "pointer",
});

function txForAccount(account, transactions) {
  return transactions.filter(t =>
    t.wallet_id === account.id ||
    (t.wallet_id == null && account.primary === true)
  );
}

export function WalletsPage({ accounts, onAdd, onSetPrimary, onDelete, transactions = [], addLocked = false, customCategories = [], userId = null, canInvite = false, onNeedPro }) {
  const { t } = useTranslation();
  const [txSheet, setTxSheet] = React.useState(null);
  const [memberSheet, setMemberSheet] = React.useState(null);   // dompet yang anggotanya dikelola
  const [joinOpen, setJoinOpen] = React.useState(false);        // sheet masukkan kode
  // Toast dipegang halaman ini, bukan diangkat ke app.jsx: pesannya butuh
  // useTranslation, dan di AuthenticatedApp nama `t` sudah dipakai objek tweaks.
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  const [deletingWallet, setDeletingWallet] = React.useState(null);
  const [deleteError, setDeleteError] = React.useState(null);
  const [deleteDropdownOpen, setDeleteDropdownOpen] = React.useState(false);
  // Hanya dompet MILIK SENDIRI yang boleh dihapus — DELETE `wallets` owner-only
  // di RLS, dan penolakannya berupa 0 baris (bukan error), jadi dompet bersama
  // yang ikut di daftar ini dulu "hilang" dari layar lalu muncul lagi saat
  // reload. Guard "sisakan minimal satu dompet" juga dihitung dari sini.
  const ownedAccounts = accounts.filter(a => !a.isShared);
  const canDeleteAny = ownedAccounts.length > 1;
  // Kekayaan bersih & rincian per tipe dihitung dari dompet MILIK SENDIRI saja
  // (Q2). Kartu dompet bersama tetap ditampilkan di grid bawah — user memang
  // perlu melihatnya — tapi saldonya bukan miliknya, jadi tidak dijumlahkan.
  const total = ownedAccounts.reduce((s, a) => s + a.balance, 0);
  const byType = ACCOUNT_TYPES.map(t => ({
    ...t, sum: ownedAccounts.filter(a => a.type === t.id).reduce((s, a) => s + a.balance, 0),
    count: ownedAccounts.filter(a => a.type === t.id).length,
  })).filter(t => t.count > 0);

  return (
    <>
    <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
            {t('dompet.eyebrow', { count: accounts.length })}
          </div>
          <h2 className="serif" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>
            {t('dompet.judulHalaman')}
          </h2>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
            {t('dompet.deskripsi')}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => canDeleteAny && setDeleteDropdownOpen(o => !o)}
            title={t('dompet.hapusDompet', { defaultValue: 'Hapus Dompet' })}
            style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "var(--terra)", color: "#fff", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500, opacity: canDeleteAny ? 1 : 0.5, cursor: canDeleteAny ? "pointer" : "not-allowed" }}>
            🗑️ {t('dompet.hapusDompet', { defaultValue: 'Hapus Dompet' })}
          </button>
          {/* "Gabung" TIDAK digerbangi Pro — yang berbayar adalah MENGUNDANG.
              Kalau menerima undangan juga butuh Pro, fitur ini tidak akan
              pernah terpakai: yang diundang justru biasanya pengguna baru. */}
          <button onClick={() => setJoinOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "var(--paper)", color: "var(--ink-2)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 13.5, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>
            🤝 {t('dompetBersama.gabung.tombolHeader')}
          </button>
          <button data-tour="wallets-add" onClick={onAdd} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500, opacity: addLocked ? 0.6 : 1, cursor: addLocked ? "not-allowed" : "pointer" }}>
            <IconPlus size={15} /> {t('dompet.tambahdompet')}
            {addLocked && <LockBadge />}
          </button>
        </div>

        {deleteDropdownOpen && canDeleteAny && (
          <>
            <div onClick={() => setDeleteDropdownOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(42,44,32,.45)", zIndex: 150 }} />
            <div className="card rise" style={{ position: "absolute", top: "100%", right: 0, width: 320, zIndex: 200, padding: 12, marginTop: 8 }}>
              <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", paddingBottom: 10, borderBottom: "1px solid var(--line-soft)", marginBottom: 10 }}>
                Pilih Dompet untuk Dihapus
              </div>
              {/* Dompet yang masih punya anggota aktif TETAP DITAMPILKAN, tapi
                  nonaktif dengan alasannya tertulis di baris itu sendiri.
                  Sengaja bukan tooltip `title=` — ini aplikasi Android
                  (Capacitor), dan tooltip hover tidak pernah muncul di layar
                  sentuh, jadi user hanya akan menemui tombol mati tanpa
                  penjelasan. Sengaja juga bukan disembunyikan: user perlu tahu
                  dompetnya masih ada dan apa yang harus dilakukan dulu.
                  Trigger 20260918000000 menjaga hal yang sama di server. */}
              {ownedAccounts.map(a => {
                const blocked = (a.memberCount || 0) > 0;
                return (
                <button key={a.id} disabled={blocked}
                  onClick={() => { if (!blocked) { setDeletingWallet(a); setDeleteDropdownOpen(false); } }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px", marginBottom: 6, borderRadius: 10, border: 0, background: "var(--paper)", color: "var(--ink)", fontSize: 13, cursor: blocked ? "not-allowed" : "pointer", textAlign: "left", opacity: blocked ? 0.55 : 1 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: `color-mix(in oklch, ${a.color} 18%, var(--ivory))`, color: a.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <WalletGlyph type={a.type} size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: blocked ? "var(--terra)" : "var(--muted)" }}>
                      {blocked
                        ? t('dompet.hapusTerkunciAnggota', { count: a.memberCount })
                        : fmtShort(a.balance)}
                    </div>
                  </div>
                </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="card rise" style={{ padding: 24, marginBottom: 20, display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{t('dompet.totalKekayaanBersih')}</div>
          <div className="serif tnum kpi-nominal" style={{ fontSize: nominalFontSize(total, { hero: true }), letterSpacing: "-0.02em", marginTop: 6 }}>{formatNominal(total)}</div>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {byType.map(wt => (
            <div key={wt.id} style={{ padding: "10px 14px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{typeLabelI18n(wt.id, t)} · {wt.count}</div>
              <div className="tnum" style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{fmtShort(wt.sum)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="stat-grid-4 wallet-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {accounts.map((a, i) => (
          <div key={a.id} className="card rise" style={{ padding: 0, overflow: "hidden", animationDelay: `${i * 0.04}s`, display: "flex", flexDirection: "column", opacity: a.is_locked ? 0.6 : 1, position: "relative" }}>
            {a.is_locked && (
              <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, background: "rgba(42,44,32,.72)", color: "#fff", borderRadius: 99, fontSize: 10.5, fontWeight: 600, padding: "2px 9px", letterSpacing: ".04em", display: "flex", alignItems: "center", gap: 4 }}>
                🔒 {t('dompet.terkunci', { defaultValue: 'Terkunci' })}
              </div>
            )}
            <div style={{ height: 6, background: a.color }} />
            <div className="wallet-card-body" style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: `color-mix(in oklch, ${a.color} 16%, var(--ivory))`, color: a.color, display: "grid", placeItems: "center" }}>
                  <WalletGlyph type={a.type} size={19} />
                </span>
                {/* Dompet bersama: tidak ada "Set utama" — UPDATE `wallets` owner-only,
                    dan setPrimary mengosongkan dompet utama milik sendiri lebih dulu. */}
                {a.is_locked
                  ? <span style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", background: "var(--paper)", padding: "3px 8px", borderRadius: 999, fontWeight: 500, border: "1px solid var(--line-soft)" }}>Soft Lock</span>
                  : a.isShared
                  ? <span style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", background: "var(--paper)", padding: "3px 8px", borderRadius: 999, fontWeight: 500, border: "1px solid var(--line-soft)" }}>{t('dompet.dibagikan')}</span>
                  : a.primary
                    ? <span style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--sage)", background: "rgba(92,107,76,.14)", padding: "3px 8px", borderRadius: 999, fontWeight: 500 }}>{t('dompet.utama')}</span>
                    : <button onClick={() => onSetPrimary(a.id)} title={t('dompet.setUtama')} style={{ fontSize: 11, color: "var(--muted)", background: "transparent", border: "1px solid var(--line-soft)", borderRadius: 999, padding: "3px 9px" }}>{t('dompet.setUtama')}</button>}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14.5, fontWeight: 500 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  <span>{a.institution}{a.last4 !== "—" ? ` ·· ${a.last4}` : ""}</span>
                </div>
              </div>
              <div style={{ marginTop: "auto", paddingTop: 18 }}>
                <div style={{ fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>{t('dompet.saldo')}</div>
                <div className="serif tnum wallet-balance-val" style={{ fontSize: 26, letterSpacing: "-0.01em", marginTop: 2 }}>{fmt(a.balance)}</div>
              </div>
            </div>
            <div className="hairline" style={{ display: "flex" }}>
              <button data-tour={i === 0 ? "wallets-tx-first" : undefined} onClick={() => setTxSheet(a)} style={{ ...cardFootBtn, flex: 1 }}>{t('dompet.transaksi')}</button>
              {/* Tombol ini ada untuk SEMUA dompet, termasuk milik user Basic.
                  Gerbang Pro-nya ada di dalam (InviteStatusBadge → onNeedPro),
                  bukan di sini: menyembunyikan tombolnya membuat user Basic
                  tidak pernah tahu fitur ini ada. Untuk dompet bersama,
                  tombol yang sama dipakai anggota untuk melihat siapa saja
                  yang punya akses dan untuk keluar. */}
              <button onClick={() => setMemberSheet(a)} style={{ ...cardFootBtn, flex: 1, borderLeft: "1px solid var(--line-soft)" }}>
                {a.memberCount > 0
                  ? t('dompetBersama.kartu.anggotaCount', { count: a.memberCount })
                  : t('dompetBersama.kartu.anggota')}
              </button>
            </div>
          </div>
        ))}

        <button onClick={onAdd} className="rise" style={{ position: "relative", border: "1.5px dashed var(--line)", borderRadius: "var(--r-lg)", background: "transparent", color: "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 220, opacity: addLocked ? 0.6 : 1, cursor: addLocked ? "not-allowed" : "pointer" }}>
          <span style={{ position: "relative", width: 48, height: 48, borderRadius: 14, background: "var(--paper)", border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", color: "var(--sage)" }}>
            <IconPlus size={22} />
            {addLocked && <LockBadge />}
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)" }}>{t('dompet.tambahdompetBaru')}</span>
          <span style={{ fontSize: 12, maxWidth: 190, textAlign: "center", lineHeight: 1.4 }}>{t('dompet.rekBankEwallet')}</span>
        </button>
      </div>
    </div>

    {/* Transaction bottom sheet */}
    {txSheet && (
      <AccountTxSheet
        account={txSheet}
        transactions={txForAccount(txSheet, transactions)}
        customCategories={customCategories}
        onClose={() => setTxSheet(null)}
      />
    )}
    {memberSheet && (
      <MemberListSheet
        wallet={memberSheet}
        userId={userId}
        // canInvite = Pro DAN pemilik dompet ini. Keduanya wajib: RPC
        // generate_wallet_invite juga memeriksa keduanya, jadi UI yang lebih
        // longgar hanya akan memunculkan penolakan server.
        canInvite={canInvite && !memberSheet.isShared}
        onNeedPro={onNeedPro}
        onToast={setToast}
        onClose={() => setMemberSheet(null)}
        onLeft={() => setMemberSheet(null)}
      />
    )}
    {joinOpen && (
      <InviteMemberSheet
        onClose={() => setJoinOpen(false)}
        onJoined={() => setToast(t('dompetBersama.toast.berhasilGabung'))}
      />
    )}
    {toast && (
      <div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 92, zIndex: 260, maxWidth: "min(92vw, 420px)", background: "var(--ink)", color: "var(--cream)", padding: "11px 16px", borderRadius: 12, fontSize: 13, lineHeight: 1.45, boxShadow: "0 8px 28px -8px rgba(42,44,32,.45)" }}>
        {toast}
      </div>
    )}
    {deletingWallet && (
      <WalletDeleteConfirmation
        wallet={deletingWallet}
        transactionCount={txForAccount(deletingWallet, transactions).length}
        onConfirm={async () => {
          // Menunggu hasilnya, bukan fire-and-forget: sejak trigger
          // 20260918000000 penghapusan bisa DITOLAK server (dompet masih punya
          // anggota aktif). Menutup modal tanpa memeriksa akan terlihat seperti
          // berhasil, lalu dompetnya muncul lagi begitu layar disegarkan.
          const res = await onDelete(deletingWallet.id);
          if (res?.reason === 'has_members') {
            setDeleteError(t('dompet.hapusDitolakAdaAnggota'));
            return;   // modal tetap terbuka, pesannya tampil di dalamnya
          }
          if (res?.error) {
            setDeleteError(t('dompet.hapusGagal'));
            return;
          }
          setDeleteError(null);
          setDeletingWallet(null);
        }}
        errorMessage={deleteError}
        onCancel={() => { setDeleteError(null); setDeletingWallet(null); }}
      />
    )}
    </>
  );
}

function AccountTxSheet({ account, transactions, customCategories = [], onClose }) {
  const { t: tr } = useTranslation();
  useScrollLock(true);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(42,44,32,.45)", zIndex: 150 }} />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxHeight: "70vh", overflowY: "auto", borderRadius: "16px 16px 0 0", background: "var(--ivory)", padding: "0 0 80px", zIndex: 200, boxShadow: "0 -8px 32px -8px rgba(42,44,32,.2)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 18px 14px", borderBottom: "1px solid var(--line-soft)", position: "sticky", top: 0, background: "var(--ivory)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('dompet.riwayat')}</div>
            <div className="serif" style={{ fontSize: 20, letterSpacing: "-0.01em", marginTop: 2 }}>{tr('dompet.transaksidompet', { nama: account.name })}</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0 }}>
            <IconClose size={14} />
          </button>
        </div>

        {/* List */}
        <div style={{ padding: "8px 16px" }}>
          {transactions.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
              {tr('dompet.belumAdaTransaksi')}
            </div>
          ) : (
            transactions.map((t, i) => {
              const cat = resolveCategory(t.category, customCategories);
              const isIncome = t.amount > 0;
              const color = cat?.color || (isIncome ? "var(--sage)" : "var(--muted-2)");
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < transactions.length - 1 ? "1px solid var(--line-soft)" : 0 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: `color-mix(in oklch, ${color} 14%, var(--ivory))`, color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <CatIcon kind={cat?.icon || t.category} size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.merchant}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>{categoryLabel(cat, tr)} · {t.date} {t.time}</div>
                  </div>
                  <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: isIncome ? "var(--sage)" : "var(--ink)", flexShrink: 0 }}>
                    {isIncome ? "+" : "−"}{fmt(Math.abs(t.amount))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function WalletDeleteConfirmation({ wallet, transactionCount, onConfirm, onCancel, errorMessage = null }) {
  const { t } = useTranslation();
  return (
    <>
      <div onClick={onCancel}
        style={{ position: "fixed", inset: 0, background: "rgba(42,44,32,.45)", zIndex: 150, animation: "rise .2s ease-out" }} />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--ivory)", borderRadius: "16px 16px 0 0", padding: "24px 20px 40px", zIndex: 200, boxShadow: "0 -8px 32px -8px rgba(42,44,32,.2)", animation: "rise .25s ease-out" }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--line)", margin: "-12px auto 20px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: "color-mix(in oklch, var(--terra) 12%, transparent)", color: "var(--terra)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <IconClose size={18} />
          </span>
          <div>
            <div className="serif" style={{ fontSize: 20, letterSpacing: "-0.01em" }}>Hapus Dompet "{wallet.name}"?</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>Aksi ini tidak bisa dibatalkan.</div>
          </div>
        </div>

        <div style={{ background: "color-mix(in oklch, var(--terra) 8%, transparent)", border: "1px solid color-mix(in oklch, var(--terra) 24%, transparent)", borderRadius: 12, padding: "12px 14px", marginTop: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
            ⚠️ <strong>{transactionCount} transaksi</strong> terhubung ke dompet ini akan <strong>hilang selamanya</strong>. Pastikan Anda sudah backup data yang penting.
          </div>
        </div>

        {/* Penolakan server (mis. dompet masih punya anggota aktif). Tampil DI
            DALAM modal, bukan sebagai toast yang lewat: user sedang menatap
            modal ini, dan pesannya berisi tindakan yang harus dia lakukan. */}
        {errorMessage && (
          <div role="alert" style={{ background: "color-mix(in oklch, var(--terra) 12%, transparent)", border: "1px solid color-mix(in oklch, var(--terra) 34%, transparent)", borderRadius: 12, padding: "11px 13px", marginBottom: 14, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: "13px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 14, color: "var(--ink-2)", fontFamily: "inherit" }}>
            Batal
          </button>
          <button onClick={onConfirm}
            style={{ flex: 1, padding: "13px", background: "var(--terra)", color: "#fff", border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>
            Hapus Selamanya
          </button>
        </div>
      </div>
    </>
  );
}

const cardFootBtn = { flex: 1, padding: "11px 0", background: "transparent", border: 0, fontSize: 12.5, color: "var(--ink-2)", display: "grid", placeItems: "center" };

const ACCOUNT_COLORS = ["#2A6FDB", "#1FA8A0", "#1B8A3F", "#9A6BD9", "#B26A4A", "#B68A3E", "#8C7B5C", "#C9886D"];

export function AddAccountModal({ open, onClose, onCreate }) {
  const { t } = useTranslation();
  useScrollLock(open);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("bank");
  const [institution, setInstitution] = React.useState("");
  const [last4, setLast4] = React.useState("");
  const [balance, setBalance] = React.useState("");
  const [color, setColor] = React.useState(ACCOUNT_COLORS[0]);
  // Dulu submit() memanggil onCreate() TANPA await lalu langsung onClose():
  // setiap kegagalan (sesi habis, RLS, jaringan) berakhir sebagai modal yang
  // menutup rapi tanpa dompet yang bertambah dan tanpa pesan apa pun.
  const [errorMsg, setErrorMsg] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) { setName(""); setType("bank"); setInstitution(""); setLast4(""); setBalance(""); setColor(ACCOUNT_COLORS[0]); setErrorMsg(""); setSubmitting(false); }
  }, [open]);

  if (!open) return null;

  const valid = name.trim().length > 0;
  const submit = async () => {
    if (!valid || submitting) return;
    setErrorMsg("");
    setSubmitting(true);
    const res = await onCreate({
      id: "a" + Date.now(),
      name: name.trim(),
      type,
      // SENGAJA typeLabel() (Indonesia mentah), BUKAN typeLabelI18n(): nilai ini
      // disimpan ke kolom `institution` di database. Kalau ikut bahasa UI, dompet
      // yang dibuat saat UI English akan tersimpan "Bank Account" dan yang dibuat
      // saat UI Indonesia "Rekening Bank" — data jadi tidak konsisten antar-baris.
      institution: institution.trim() || typeLabel(type),
      last4: last4.trim() || "—",
      balance: +String(balance).replace(/\D/g, "") || 0,
      color,
      primary: false,
    });
    setSubmitting(false);
    // limitReached: paywall sudah dibuka hook, modal boleh menutup.
    if (res?.limitReached) { onClose(); return; }
    // Gagal → modal TETAP terbuka supaya isian tidak hilang dan user tahu.
    if (res?.error) { setErrorMsg(res.error.message || t('umum.simpanGagal')); return; }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 50, background: "rgba(42,44,32,.32)", backdropFilter: "blur(4px)", padding: 20, animation: "rise .25s ease-out" }}>
      <div className="card modal-sheet" onClick={e => e.stopPropagation()} style={{ width: 500, padding: 28, animation: "rise .3s ease-out", boxShadow: "0 30px 80px -20px rgba(42,44,32,.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{t('dompet.dompetBaru')}</div>
            <div className="serif" style={{ fontSize: 28, marginTop: 4, letterSpacing: "-0.01em" }}>{t('dompet.tambahdompetModal')}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
            <IconClose size={14} />
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <span style={fieldLabel}>{t('dompet.jenisdompet')}</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {ACCOUNT_TYPES.map(wt => (
              <button key={wt.id} onClick={() => setType(wt.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "12px 6px", borderRadius: 12, background: type === wt.id ? "var(--ivory)" : "var(--paper)", border: "1px solid " + (type === wt.id ? "var(--ink)" : "var(--line-soft)"), color: "var(--ink)" }}>
                <WalletGlyph type={wt.id} size={18} />
                <span style={{ fontSize: 11, textAlign: "center", lineHeight: 1.2 }}>{typeLabelI18n(wt.id, t)}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <label style={{ gridColumn: "span 2" }}>
            <span style={fieldLabel}>{t('dompet.namadompet')}</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="contoh: BCA Tabungan" style={modalInput} />
          </label>
          <label>
            <span style={fieldLabel}>{t('dompet.bankPenyedia')}</span>
            <input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="contoh: Bank Central Asia" style={modalInput} />
          </label>
          <label>
            <span style={fieldLabel}>{t('dompet.empatDigitTerakhir')}</span>
            <input value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4421" style={modalInput} />
          </label>
          <label style={{ gridColumn: "span 2" }}>
            <span style={fieldLabel}>{t('dompet.saldoAwal')}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Rp</span>
              <input value={balance ? (+String(balance).replace(/\D/g, "")).toLocaleString("id-ID") : ""}
                onChange={e => setBalance(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                style={{ ...modalInput, border: 0, background: "transparent", padding: "10px 0", fontVariantNumeric: "tabular-nums" }} />
            </div>
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <span style={fieldLabel}>{t('dompet.warna')}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {ACCOUNT_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: 0, outline: color === c ? "2px solid var(--ink)" : "2px solid transparent", outlineOffset: 2, cursor: "pointer" }} />
            ))}
          </div>
        </div>

        {errorMsg && (
          <div role="alert" style={{ marginTop: 18, background: "color-mix(in oklch, var(--terra) 12%, transparent)", border: "1px solid color-mix(in oklch, var(--terra) 34%, transparent)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
            {errorMsg}
          </div>
        )}

        <div className="modal-actions" style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 13.5, color: "var(--ink-2)" }}>{t('umum.batal')}</button>
          <button onClick={submit} disabled={!valid || submitting} style={{ flex: 2, padding: "11px", background: (valid && !submitting) ? "var(--ink)" : "var(--line)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500, cursor: (valid && !submitting) ? "pointer" : "default" }}>{submitting ? t('umum.menyimpan') : t('dompet.buatdompet')}</button>
        </div>
      </div>
    </div>
  );
}

const fieldLabel = { display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 };
const modalInput = { width: "100%", padding: "10px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: "var(--ink)", fontSize: 13, fontFamily: "inherit", outline: "none" };
