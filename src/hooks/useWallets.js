import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { usePaywall } from '../components/PaywallModal';
import { logError } from '../lib/errorLogger';
import { fetchSharedMemberships, sharedOrFilter } from '../lib/walletAccess';

const FALLBACK_COLORS = ["#2A6FDB","#1FA8A0","#1B8A3F","#9A6BD9","#B26A4A","#B68A3E","#5C6B4C","#C9886D"];
const pickColor = (name) => FALLBACK_COLORS[(name || '').charCodeAt(0) % FALLBACK_COLORS.length];

// roleById: Map wallet_id → 'editor' | 'viewer' untuk dompet bersama.
// Dompet yang `user_id`-nya bukan user ini = dompet bersama milik orang lain.
function toAppWallet(row, userId, roleById) {
  const isShared = !!userId && row.user_id !== userId;
  const role     = isShared ? (roleById?.get(row.id) || null) : 'owner';
  return {
    id:          row.id,
    name:        row.name,
    institution: row.bank  || '',
    bank:        row.bank  || '',
    type:        row.type  || 'bank',
    balance:     Number(row.balance) || 0,
    color:       row.color || pickColor(row.name),
    // `is_primary` di baris dompet bersama adalah dompet utama si OWNER, bukan
    // milik user ini. Kalau ikut terbawa, user bisa punya dua dompet utama dan
    // `accounts.find(a => a.primary)` bisa memilih dompet teman sebagai
    // default catat transaksi — transaksi pribadi tercatat ke dompet orang.
    primary:     !isShared && (row.is_primary || false),
    last4:       row.last4 || '—',
    is_locked:   row.is_locked || false,
    ownerId:     row.user_id,
    isShared,
    role,
    // Boleh dipakai mencatat transaksi / disesuaikan saldonya. Viewer tidak.
    canWrite:    role === 'owner' || role === 'editor',
  };
}

export function useWallets(userId, limits) {
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const { openPaywall } = usePaywall();
  const { t } = useTranslation();

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let alive = true;
    let channel = null;
    setLoading(true);

    (async () => {
      // Dompet bersama (Fitur B) tidak bisa ditemukan lewat `user_id` — barisnya
      // milik owner. Daftar id-nya harus diambil duluan karena dipakai dua kali:
      // sebagai penyaring query di bawah, DAN sebagai filter realtime.
      const memberships = await fetchSharedMemberships(userId);
      if (!alive) return;
      const sharedIds = memberships.map(m => m.walletId);
      const roleById  = new Map(memberships.map(m => [m.walletId, m.role]));

      let query = supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });

      const orFilter = sharedOrFilter(userId, sharedIds, 'id');
      // Tanpa dompet bersama, tetap pakai .eq() seperti dulu: lebih murah dan
      // perilakunya identik dengan sebelum Fitur B ada.
      query = orFilter ? query.or(orFilter) : query.eq('user_id', userId);

      const { data, error } = await query;
      if (!alive) return;
      if (error) {
        console.error('[useWallets] fetch error:', error.code, error.message);
      } else {
        setAccounts((data || []).map(row => toAppWallet(row, userId, roleById)));
      }
      setLoading(false);

      // Realtime UPDATE: picks up is_locked changes from lockExcessOnDowngrade/unlockAllOnUpgrade,
      // DAN setiap perubahan `balance` dari mana pun (adjust_wallet_balance /
      // record_transaction, tab lain, device lain, atau anggota dompet bersama).
      //
      // PENTING — kenapa handler ini menulis nilai ABSOLUT dari payload.new, bukan
      // menambah delta: tabel `wallets` ada di publication `supabase_realtime`, jadi
      // event ini ikut menyala untuk perubahan yang dipicu device ini sendiri, dan
      // urutan kedatangannya TIDAK dijamin relatif terhadap response RPC-nya.
      // Menyetel nilai absolut bersifat idempoten — datang sebelum atau sesudah
      // response, hasil akhirnya sama. Jangan pernah menambahkan penulis state saldo
      // kedua yang bekerja dengan DELTA (mis. `balance + delta`): dua penulis delta,
      // atau satu delta + satu absolut, akan menggandakan saldo di UI secara acak
      // tergantung siapa yang sampai duluan. Itu persis bug saldo dobel 11 Sep 2026.
      const applyRow = (payload) => {
        if (!alive) return;
        setAccounts(prev => prev.map(a =>
          // `user_id` lama dipakai sebagai cadangan: kalau payload tidak
          // membawanya, dompet sendiri jangan sampai terbaca "bersama" (dan
          // kehilangan primary/canWrite) hanya karena satu event realtime.
          a.id === payload.new.id ? toAppWallet({ user_id: a.ownerId, ...payload.new }, userId, roleById) : a
        ));
      };

      // DUA binding, bukan satu. Dompet sendiri tetap disaring `user_id=eq.X`
      // supaya dompet yang dibuat SETELAH langganan ini tetap terpantau tanpa
      // perlu subscribe ulang. Dompet bersama tidak punya kolom yang bisa
      // dipakai begitu, jadi harus daftar id eksplisit — konsekuensinya daftar
      // itu snapshot: dompet yang dibagikan ke user SETELAH ini tidak terpantau
      // sampai hook ini mount ulang.
      channel = supabase
        .channel(`wallets_lock:${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` },
          applyRow
        );

      if (sharedIds.length) {
        channel = channel.on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `id=in.(${sharedIds.join(',')})` },
          applyRow
        );
      }

      channel.subscribe();
    })();

    // channel bisa masih null kalau effect dibersihkan sebelum fetch selesai;
    // `alive` di atas yang mencegah subscribe-nya terlanjur jalan.
    return () => { alive = false; if (channel) supabase.removeChannel(channel); };
  }, [userId]);

  async function createAccount(a) {
    // ── Batas plan: tolak insert bila sudah mencapai limit ────────
    const maxWallets = limits?.maxWallets ?? Infinity;
    if (accounts.length >= maxWallets) {
      openPaywall(t('paywall.feature.walletTambahan'));
      return { error: null, limitReached: true };
    }

    // ── Kolom base schema (selalu ada) ────────────────────────────
    // AddAccountModal kirim 'institution', schema pakai 'bank'
    const basePayload = {
      user_id:    userId,
      name:       a.name        || '',
      bank:       a.institution || a.bank || '',
      type:       a.type        || 'bank',
      balance:    a.balance     || 0,
      is_primary: a.primary     || false,
    };

    const { data, error } = await supabase
      .from('wallets')
      .insert(basePayload)
      .select()
      .single();

    if (error) {
      console.error('[useWallets] createAccount FAILED:', error.code, error.message, error.details);
      return { error };
    }

    // Simpan color & last4 di local state
    const wallet = {
      ...toAppWallet(data, userId),
      color: a.color || pickColor(a.name),
      last4: a.last4 || '—',
    };
    setAccounts(prev => [...prev, wallet]);

    // ── Coba update color + last4 jika kolom ada (setelah migrations.sql) ──
    supabase
      .from('wallets')
      .update({ color: a.color || pickColor(a.name), last4: a.last4 || '—' })
      .eq('id', data.id)
      .then(({ error: ue }) => {
        if (ue && !ue.message?.includes('column')) {
          console.warn('[useWallets] color/last4 update skipped:', ue.message);
        }
      });

    return { error: null };
  }

  // PENTING untuk setPrimary & deleteAccount: UPDATE/DELETE yang ditolak RLS
  // (dompet bersama — policy tulis `wallets` owner-only) TIDAK menghasilkan
  // error, cuma 0 baris. Karena itu keduanya menolak dompet bersama di depan
  // DAN memeriksa jumlah baris yang benar-benar tersentuh lewat `.select('id')`
  // — jangan pernah menganggap "error null" = berhasil.
  const notAffected = (fn) => new Error(`${fn}: tidak ada baris yang berubah (dompet bukan milikmu atau sudah tidak ada)`);

  async function setPrimary(id) {
    const target = accounts.find(a => a.id === id);
    if (!target || target.isShared) {
      const error = notAffected('setPrimary');
      console.error('[useWallets] setPrimary DITOLAK:', error.message);
      return { error };
    }

    // Urutan SENGAJA: tandai target dulu, BARU kosongkan yang lain. Urutan lama
    // (kosongkan semua → tandai target) meninggalkan user TANPA dompet utama di
    // DB kalau langkah kedua gagal / kena 0 baris.
    const { data, error: setErr } = await supabase
      .from('wallets').update({ is_primary: true })
      .eq('id', id).eq('user_id', userId)
      .select('id');
    const error = setErr || (data?.length ? null : notAffected('setPrimary'));
    if (error) {
      console.error('[useWallets] setPrimary FAILED:', error.message);
      return { error };
    }

    const { error: clearErr } = await supabase
      .from('wallets').update({ is_primary: false })
      .eq('user_id', userId).neq('id', id);
    if (clearErr) {
      // Target sudah jadi utama; yang lama mungkin masih ikut bertanda utama
      // di DB. State dibiarkan mencerminkan itu, bukan dipaksa rapi.
      console.error('[useWallets] setPrimary clear-others FAILED:', clearErr.message);
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, primary: true } : a));
      return { error: clearErr };
    }

    // Dompet bersama tidak pernah primary (lihat toAppWallet) — jangan disentuh.
    setAccounts(prev => prev.map(a => a.isShared ? a : { ...a, primary: a.id === id }));
    return { error: null };
  }

  async function deleteAccount(id) {
    const target = accounts.find(a => a.id === id);
    if (!target || target.isShared) {
      const error = notAffected('deleteAccount');
      console.error('[useWallets] deleteAccount DITOLAK:', error.message);
      return { error };
    }

    const { data, error: delErr } = await supabase
      .from('wallets').delete()
      .eq('id', id).eq('user_id', userId)
      .select('id');
    const error = delErr || (data?.length ? null : notAffected('deleteAccount'));
    if (error) {
      console.error('[useWallets] deleteAccount FAILED:', error.message);
    } else {
      setAccounts(prev => prev.filter(a => a.id !== id));
    }
    return { error };
  }

  // Balance adjustment: SATU panggilan RPC atomik — lihat migrasi
  // 20260911000000_add_atomic_adjust_wallet_balance.sql. Postgres yang menghitung
  // `balance = balance + delta` di dalam satu UPDATE terkunci, jadi nilai basi tidak
  // pernah singgah di JavaScript. Ini menggantikan pola SELECT-lalu-UPDATE lama yang
  // rawan lost update: dua penulis bersamaan (dua device, atau tab + widget) sama-sama
  // membaca saldo yang sama lalu saling menimpa hasil hitungan masing-masing.
  //
  // Kontrak return SENGAJA tetap { error } (bukan throw) seperti versi lama. Pemanggil
  // di useDebts.js — createDebt/addPayment/deleteDebt — memperlakukan kegagalan saldo
  // sebagai best-effort: catatan hutang yang sudah terlanjur tersimpan TIDAK boleh
  // dibatalkan, cukup dicatat (high) untuk rekonsiliasi manual. Kalau fungsi ini
  // melempar, throw-nya lolos ke tengah createDebt setelah baris debts + transaksi
  // pokok commit, dan justru melewati logError yang dipasang untuk kasus itu.
  async function adjustBalance(walletId, delta) {
    if (!walletId || !delta) return { error: null };

    // Identitas pemanggil diambil server dari auth.uid(); userId TIDAK dikirim sebagai
    // argumen supaya tidak bisa dipalsukan. Cek kepemilikan dompet ada di dalam RPC.
    const { data: newBalance, error } = await supabase.rpc('adjust_wallet_balance', {
      p_wallet_id: walletId,
      p_delta:     delta,
    });

    if (error) {
      // Gagal update saldo = uang/data permanen terdampak → catat (high).
      console.error('[useWallets] adjustBalance RPC FAILED:', error.code, error.message);
      logError('adjustBalance', error.message, {
        wallet_id: walletId, delta, code: error.code,
      }, 'high');
      return { error };
    }

    // Saldo baru datang dari server (otoritatif hasil UPDATE terkunci), bukan hitungan
    // lokal — jadi state tetap benar walau ada penulis lain yang commit di sela-sela.
    const balance = Number(newBalance);
    setAccounts(prev => prev.map(a =>
      a.id === walletId ? { ...a, balance } : a
    ));
    return { error: null, balance };
  }

  // Dompet yang boleh dipakai mencatat transaksi: milik sendiri + dompet
  // bersama ber-peran editor. Dipakai semua picker dompet untuk MENULIS
  // (catat transaksi, transaksi berulang, hutang) — dompet viewer akan ditolak
  // record_transaction.
  const writableAccounts = React.useMemo(() => accounts.filter(a => a.canWrite), [accounts]);

  return { accounts, writableAccounts, loading, createAccount, setPrimary, deleteAccount, adjustBalance };
}
