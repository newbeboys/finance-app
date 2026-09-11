import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { usePaywall } from '../components/PaywallModal';
import { fetchSharedWalletIds, sharedOrFilter } from '../lib/walletAccess';

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

// Supabase row → format yang dipakai komponen app
function toAppTx(row) {
  const d = new Date(row.date + 'T00:00:00');
  return {
    id:        row.id,
    date:      `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    dateRaw:   row.date,   // ISO: "2026-06-04" — dipakai untuk grouping cashflow
    time:      row.time     || '00:00',
    merchant:  row.merchant || '—',
    note:      row.note     || '',
    category:  row.category,
    method:    row.method   || 'Tunai',
    amount:    Number(row.amount),
    wallet_id: row.wallet_id || null,
    debt_id:   row.debt_id  || null,   // != null → transaksi dari fitur Hutang/Piutang
    // Pencatat transaksi. Sejak dompet bersama, daftar ini juga memuat
    // transaksi yang dicatat ORANG LAIN — lihat canEditTransaction /
    // canDeleteTransaction di lib/walletAccess.js.
    user_id:   row.user_id  || null,
  };
}

export function useTransactions(userId, limits) {
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const { openPaywall } = usePaywall();
  const { t } = useTranslation();

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let alive = true;

    setLoading(true);
    setError(null);

    (async () => {
      // Transaksi di dompet bersama dicatat atas nama ORANG LAIN (user_id-nya
      // si pencatat), jadi `.eq('user_id', …)` saja akan menyembunyikannya.
      // Disaring lewat wallet_id dompet yang boleh diakses.
      const sharedIds = await fetchSharedWalletIds(userId);
      if (!alive) return;

      let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      // excludeDebt: transaksi hutang/piutang orang lain di dompet bersama
      // tidak pernah ikut terbaca (Task 2 #4) — cerminan policy SELECT.
      const orFilter = sharedOrFilter(userId, sharedIds, 'wallet_id', { excludeDebt: true });
      // Cabang `user_id` tetap ada di dalam orFilter — bukan cuma wallet_id —
      // supaya transaksi yang dulu user catat di dompet yang aksesnya sudah
      // dicabut (dia keluar dari dompet itu) tetap muncul di riwayatnya sendiri.
      query = orFilter ? query.or(orFilter) : query.eq('user_id', userId);

      const { data, error: err } = await query;
      if (!alive) return;
      if (err) {
        setError(err.message);
      } else {
        setTransactions((data || []).map(toAppTx));
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [userId]);

  async function createTransaction(tx) {
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    // Tanggal pilihan user (ISO yyyy-mm-dd); fallback ke hari ini
    const isoDate = tx.dateRaw || todayISO;

    // ── Batas plan: maks N transaksi per BULAN KALENDER ────────────────
    // Bulan ditentukan dari tanggal transaksi yang dipilih user (isoDate),
    // bukan created_at. Count via Supabase (head:true) — tidak fetch row.
    // Transaksi otomatis dari fitur Hutang/Piutang (punya debt_id) TIDAK
    // dihitung ke kuota, dan pembuatannya tidak boleh diblokir kuota.
    const maxPerMonth = limits?.maxTransactionsPerMonth ?? Infinity;
    if (maxPerMonth !== Infinity && !tx.debt_id) {
      const [y, m] = isoDate.split('-').map(Number);
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
      const nextY = m === 12 ? y + 1 : y;
      const nextM = m === 12 ? 1 : m + 1;
      const monthEndExclusive = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

      const { count, error: cErr } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('debt_id', null)   // kecualikan transaksi hutang/piutang dari kuota
        .gte('date', monthStart)
        .lt('date', monthEndExclusive);

      if (cErr) {
        console.error('[useTransactions] count error:', cErr.code, cErr.message);
      } else if ((count ?? 0) >= maxPerMonth) {
        openPaywall({ message: t('paywall.message.transaksiLimit') });
        return { error: null, limitReached: true };
      }
    }

    // ── Tulis via RPC atomik ──────────────────────────────────────────
    // record_transaction() (migrasi 20260911010000) meng-INSERT baris transaksi
    // DAN menyesuaikan saldo dompet dalam satu transaksi Postgres. Sebelumnya
    // dua langkah terpisah (insert di sini, adjustBalance di app.jsx) yang bisa
    // putus di tengah dan menyisakan transaksi tanpa perubahan saldo.
    //
    // `type` dan tanda amount TIDAK dikirim terpisah — fungsi menurunkan type
    // dari tanda amount, jadi keduanya mustahil bertentangan.
    //
    // Kuota plan SENGAJA tetap dicek di atas (JS), bukan di dalam RPC:
    // src/lib/planLimits.js adalah sumber tunggal semua batas, dan cek di sini
    // yang memunculkan paywall. Jangan pindahkan/duplikasi ambangnya ke SQL.
    const { data: newId, error: err } = await supabase.rpc('record_transaction', {
      p_amount:    tx.amount,
      p_category:  tx.category,
      p_date:      isoDate,
      p_wallet_id: tx.wallet_id || null,
      p_merchant:  tx.merchant  || '',
      p_note:      tx.note      || '',
      p_time:      tx.time      || '00:00',
      p_method:    tx.method    || 'Tunai',
      p_debt_id:   tx.debt_id   || null,   // tautan ke catatan hutang/piutang (null utk transaksi biasa)
    });

    if (err) {
      console.error('[useTransactions] record_transaction FAILED:', err.code, err.message);
    } else if (newId) {
      // RPC mengembalikan id saja; sisa kolomnya sudah kita ketahui persis
      // (nilai yang baru saja dikirim), jadi baris untuk state dirakit di sini
      // tanpa perlu SELECT tambahan.
      setTransactions(prev => [toAppTx({
        id:        newId,
        type:      tx.amount < 0 ? 'expense' : 'income',
        amount:    tx.amount,
        category:  tx.category,
        merchant:  tx.merchant  || '',
        note:      tx.note      || '',
        date:      isoDate,
        time:      tx.time      || '00:00',
        method:    tx.method    || 'Tunai',
        wallet_id: tx.wallet_id || null,
        debt_id:   tx.debt_id   || null,
        user_id:   userId,   // record_transaction menulis user_id = auth.uid()
      }), ...prev]);
    }
    // id dikembalikan agar useDebts bisa menautkannya ke debt_payments.transaction_id
    return { error: err, id: newId ?? null };
  }

  // ── Hapus & ubah: RPC atomik (migrasi 20260916000000) ─────────────
  // delete_transaction / update_transaction menulis baris DAN menyesuaikan
  // saldo dompet dalam satu transaksi Postgres — sama seperti record_transaction
  // untuk create. Jadi pemanggil TIDAK BOLEH memanggil adjustBalance lagi
  // (dobel di DB); saldo baru sampai ke state lewat realtime useWallets.
  //
  // Kenapa bukan .delete()/.update() + adjustBalance seperti dulu:
  //  - baris milik orang lain di dompet bersama ditolak RLS sebagai 0 BARIS,
  //    bukan error → adjustBalance tetap jalan → saldo bergeser padahal
  //    transaksinya masih ada;
  //  - bekas anggota/viewer lolos DELETE (policy cuma cek user_id) tapi
  //    adjust_wallet_balance menolak mereka → baris hilang, saldo tidak dibalik.
  // RPC-nya memvalidasi `user_id = auth.uid()` dan RAISE kalau bukan milik
  // pemanggil, jadi kegagalan selalu berupa error, tidak pernah "sukses kosong".
  async function deleteTransaction(id) {
    const { error: err } = await supabase.rpc('delete_transaction', { p_transaction_id: id });
    if (err) {
      console.error('[useTransactions] delete_transaction FAILED:', err.code, err.message);
    } else {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
    return { error: err };
  }

  async function updateTransaction(id, updates) {
    const { data, error: err } = await supabase.rpc('update_transaction', {
      p_transaction_id: id,
      p_amount:    updates.amount,
      p_category:  updates.category,
      p_wallet_id: updates.wallet_id || null,   // null = dompet lama dipertahankan
      p_merchant:  updates.merchant || '',
      p_note:      updates.note     || '',
      p_method:    updates.method   || 'Tunai',
      p_date:      updates.dateRaw  || null,     // null = tanggal lama (bukan CURRENT_DATE/UTC)
      p_time:      updates.time     || null,
    });

    if (err || !data) {
      console.error('[useTransactions] update_transaction FAILED:', err?.code, err?.message);
      return { error: err || new Error('update_transaction: tidak ada baris dikembalikan') };
    }
    setTransactions(prev => prev.map(t => t.id === id ? toAppTx(data) : t));
    return { error: null };
  }

  return { transactions, loading, error, createTransaction, deleteTransaction, updateTransaction };
}
