import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { usePaywall } from '../components/PaywallModal';
import { fetchSharedWalletIds, fetchOwnedWalletIds, sharedOrFilter } from '../lib/walletAccess';
import { isAppLocked } from './useAutoLock';

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

// Jeda minimum antar-refetch OTOMATIS (app kembali ke foreground). Pull-to-refresh
// manual sengaja TIDAK tunduk pada angka ini — lihat refreshTransactions().
export const AUTO_REFETCH_MIN_INTERVAL_MS = 60 * 1000;

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

// opts.syncBalances: useWallets.syncBalances — dipanggil setelah setiap RPC
// tulis yang berhasil dengan id dompet yang saldonya baru saja diubah server.
// Opsional (harness memanggil hook ini tanpa useWallets).
export function useTransactions(userId, limits, opts = {}) {
  // Ref, bukan dependency: identitas fungsinya stabil (useCallback []), tapi
  // pemanggil tidak wajib menjaminnya, dan ketiga fungsi tulis di bawah tidak
  // di-memoize — ref membuat mereka selalu memakai versi terbaru.
  const syncBalancesRef = React.useRef(null);
  syncBalancesRef.current = opts.syncBalances || null;
  // Fire-and-forget: tulisnya sudah BERHASIL di server, jadi gagal menarik
  // saldo tidak boleh berubah jadi error transaksi (syncBalances mencatat
  // kegagalannya sendiri). Tidak di-await supaya pemanggil (modal, useDebts)
  // tidak menunggu satu round-trip ekstra.
  const syncBalances = (walletIds, knownRows) => { syncBalancesRef.current?.(walletIds, knownRows); };

  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const { openPaywall } = usePaywall();
  const { t } = useTranslation();

  // Epoch ms fetch SUKSES terakhir; 0 = belum pernah. Dasar debounce #2.
  // Fetch yang gagal sengaja tidak memperbaruinya supaya percobaan berikutnya
  // tidak ikut kena rem.
  const lastFetchAtRef = React.useRef(0);
  // Promise dari tulisan (create/update/delete) yang sedang berjalan.
  // Fetch yang berangkat sebelum RPC tulis commit akan mengembalikan daftar
  // versi lama dan menghapus lagi baris yang baru masuk state — jadi KEDUA
  // jalur fetch harus menunggu himpunan ini kosong dulu.
  // Disimpan sebagai promise, bukan counter: counter cuma bisa menjawab
  // "ada tulisan?", sedangkan yang dibutuhkan adalah MENUNGGU-nya selesai.
  const inFlightWritesRef = React.useRef(new Set());
  // Nomor urut fetch: hanya hasil fetch TERAKHIR yang boleh menulis state,
  // jadi dua fetch yang balapan tidak bisa saling menimpa dengan data basi.
  const fetchSeqRef = React.useRef(0);
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Badan fetch, dipisah dari useEffect agar bisa dipanggil ulang ────
  // Dipakai tiga pemanggil: load awal, refetch otomatis saat app kembali ke
  // foreground, dan pull-to-refresh manual. Perilakunya SAMA di ketiganya —
  // REPLACE penuh, daftar hasil query menggantikan seluruh state. Tidak ada
  // logika merge per baris: itu yang menjamin hasil refetch identik dengan
  // load awal (baris yang dihapus orang lain benar-benar hilang, bukan
  // menyisa karena tidak ada di payload).
  //
  // `silent` = jangan sentuh `loading` (dipakai refetch/refresh, supaya daftar
  // yang sudah tampil tidak berkedip jadi skeleton).
  const fetchTransactions = React.useCallback(async ({ silent = false } = {}) => {
    if (!userId) return { error: null, skipped: 'no-user' };

    const seq = ++fetchSeqRef.current;
    // Basi kalau komponen sudah unmount ATAU sudah ada fetch yang lebih baru.
    const isStale = () => !mountedRef.current || seq !== fetchSeqRef.current;

    if (!silent) setLoading(true);
    setError(null);

    // Transaksi di dompet bersama dicatat atas nama ORANG LAIN (user_id-nya
    // si pencatat), jadi `.eq('user_id', …)` saja akan menyembunyikannya —
    // baik dompet ITU DIMILIKI user (owner tidak pernah punya baris di
    // wallet_members untuk dompetnya sendiri, jadi fetchSharedWalletIds saja
    // TIDAK CUKUP — lihat rationale fetchOwnedWalletIds di walletAccess.js)
    // MAUPUN dompet itu dibagikan KE user (fetchSharedWalletIds). Kedua
    // daftar digabung supaya cabang wallet_id.in.(…) di bawah mencerminkan
    // persis policy SELECT server: wallet_access_role(wallet_id) IS NOT NULL
    // (dompet yang saya miliki ATAU dompet yang saya jadi anggota aktifnya).
    const [sharedIds, ownedIds] = await Promise.all([
      fetchSharedWalletIds(userId),
      fetchOwnedWalletIds(userId),
    ]);
    if (isStale()) return { error: null, skipped: 'stale' };
    const walletIds = [...new Set([...sharedIds, ...ownedIds])];

    let query = supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    // excludeDebt: transaksi hutang/piutang orang lain di dompet bersama
    // tidak pernah ikut terbaca (Task 2 #4) — cerminan policy SELECT.
    const orFilter = sharedOrFilter(userId, walletIds, 'wallet_id', { excludeDebt: true });
    // Cabang `user_id` tetap ada di dalam orFilter — bukan cuma wallet_id —
    // supaya transaksi yang dulu user catat di dompet yang aksesnya sudah
    // dicabut (dia keluar dari dompet itu) tetap muncul di riwayatnya sendiri.
    query = orFilter ? query.or(orFilter) : query.eq('user_id', userId);

    const { data, error: err } = await query;
    if (isStale()) return { error: null, skipped: 'stale' };

    if (err) {
      setError(err.message);
    } else {
      setTransactions((data || []).map(toAppTx));
      lastFetchAtRef.current = Date.now();
    }
    if (!silent) setLoading(false);
    return { error: err ?? null, skipped: null };
  }, [userId]);

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    // Ganti user → jam debounce direset, jangan sampai fetch user sebelumnya
    // menahan load awal user ini.
    lastFetchAtRef.current = 0;
    fetchTransactions();
  }, [userId, fetchTransactions]);

  // ── Antre di belakang tulisan yang sedang terbang ────────────────────
  // Dipakai KEDUA jalur fetch — tidak ada versi "cek sekali lalu skip".
  // Alasannya sama untuk keduanya: fetch yang berangkat sebelum RPC tulis
  // commit akan me-REPLACE daftar dengan versi sebelum tulisan itu.
  //
  // `allSettled`, bukan `all`: tulisan yang ditolak RLS (42501) tidak boleh
  // menggantung fetch selamanya.
  // `while`, bukan sekali tunggu: tulisan baru bisa berangkat selagi kita
  // menunggu, dan fetch tetap tidak boleh jalan selama masih ada yang terbang.
  const drainWrites = React.useCallback(async () => {
    while (inFlightWritesRef.current.size > 0) {
      await Promise.allSettled([...inFlightWritesRef.current]);
    }
  }, []);

  // ── Refetch OTOMATIS (app kembali ke foreground) ─────────────────────
  // Dipanggil oleh pemicu yang BUKAN aksi eksplisit user. Dua rem yang
  // MEMBATALKAN (skip, bukan antre — resume beruntun tidak boleh menumpuk
  // request yang lalu dieksekusi berbarengan):
  //   1. gerbang keamanan PIN/biometrik sedang aktif → data user tidak boleh
  //      diambil/diperbarui di belakang layar kunci;
  //   2. belum lewat AUTO_REFETCH_MIN_INTERVAL_MS sejak fetch sukses terakhir.
  // Tulisan in-flight BUKAN rem pembatal: jalur ini MENGANTRE lewat
  // drainWrites(), sama persis dengan pull-to-refresh manual. Sebelumnya
  // di-skip sekali di titik trigger, dan itu asimetris tanpa alasan —
  // efeknya resume yang kebetulan bertabrakan dengan sebuah tulisan
  // kehilangan sinkronisasinya sampai 60 detik berikutnya.
  //
  // Kedua rem DIPERIKSA ULANG setelah antre: menunggu tulisan bisa makan
  // waktu, dan dalam jeda itu app bisa keburu terkunci atau fetch lain bisa
  // sudah sukses duluan. Memeriksa sekali di depan saja akan membuat fetch
  // tetap berangkat di balik layar kunci.
  // Mengembalikan alasan skip (Promise) supaya bisa diperiksa saat debug.
  const autoRefetchTransactions = React.useCallback(async () => {
    const blocked = () => {
      if (isAppLocked()) return 'locked';
      if (Date.now() - lastFetchAtRef.current < AUTO_REFETCH_MIN_INTERVAL_MS) return 'debounced';
      return null;
    };

    let why = blocked();
    if (why) return { skipped: why };

    await drainWrites();

    why = blocked();
    if (why) return { skipped: why };

    await fetchTransactions({ silent: true });
    return { skipped: null };
  }, [fetchTransactions, drainWrites]);

  // ── Pull-to-refresh MANUAL ───────────────────────────────────────────
  // Aksi eksplisit user, jadi TIDAK PERNAH di-skip diam-diam: tombol yang
  // ditekan user harus selalu benar-benar mengambil data. Bedanya dengan
  // jalur otomatis tinggal satu hal — debounce (lastFetchAtRef) DIABAIKAN,
  // karena user menekan tombol justru karena dia mau data sekarang, bukan
  // 60 detik lagi. Perlakuan terhadap tulisan in-flight sudah sama: antre.
  //
  // `refreshing` tetap true selama antre, jadi spinner-nya jujur menunjukkan
  // tombolnya masih bekerja.
  const refreshTransactions = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await drainWrites();
      return await fetchTransactions({ silent: true });
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [fetchTransactions, drainWrites]);

  // ── Pendaftar tulisan in-flight ──────────────────────────────────────
  // Semua penulis lewat sini, bukan mendaftar manual di dalam tiap badan
  // fungsi: satu tempat saja, jadi tidak ada jalur `return` lebih awal
  // (mis. limitReached) atau exception yang bisa lupa mencabut pendaftarannya.
  // `finally` menjamin tercabut untuk sukses MAUPUN gagal.
  //
  // Pendaftarannya sinkron, sedangkan `run` dan callback `finally` baru jalan
  // di microtask berikutnya — jadi urutan add-lalu-delete selalu terjaga.
  function trackWrite(run) {
    const p = Promise.resolve()
      .then(run)
      .finally(() => { inFlightWritesRef.current.delete(p); });
    inFlightWritesRef.current.add(p);
    return p;
  }

  // Pembungkusnya sengaja fungsi biasa (bukan useCallback): identitasnya ikut
  // berubah tiap render persis seperti implementasi aslinya, jadi tidak ada
  // closure basi atas `userId`/`limits` yang ikut terbawa.
  function createTransaction(tx)          { return trackWrite(() => createTransactionInner(tx)); }
  function deleteTransaction(id)          { return trackWrite(() => deleteTransactionInner(id)); }
  function updateTransaction(id, updates) { return trackWrite(() => updateTransactionInner(id, updates)); }

  async function createTransactionInner(tx) {
    // TIDAK ADA gerbang requireUserId() di sini — dan itu disengaja, bukan
    // celah yang tertinggal saat merge dari main (hotfix identitas). Jalur
    // itu berguna untuk INSERT langsung, yang menaruh `user_id` dari state
    // React ke payload. Di branch ini createTransaction memanggil RPC
    // record_transaction (migrasi 20260911010000), yang MENURUNKAN user_id
    // dari auth.uid() DI SERVER — payload tidak pernah membawa identitas
    // apa pun, jadi tidak ada "prop basi vs JWT" yang bisa melenceng untuk
    // dicegat di sini. Menambahkan requireUserId() di titik ini hanya akan
    // menduplikasi apa yang sudah dijamin RPC-nya sendiri.
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
      // RPC mengembalikan id saja, bukan saldo baru → syncBalances men-SELECT.
      syncBalances([tx.wallet_id]);
    }
    // id dikembalikan agar useDebts bisa menautkannya ke debt_payments.transaction_id
    return { error: err, id: newId ?? null };
  }

  // ── Hapus & ubah: RPC atomik (migrasi 20260916000000) ─────────────
  // delete_transaction / update_transaction menulis baris DAN menyesuaikan
  // saldo dompet dalam satu transaksi Postgres — sama seperti record_transaction
  // untuk create. Jadi pemanggil TIDAK BOLEH memanggil adjustBalance lagi
  // (dobel di DB); saldo baru ditarik ke state oleh syncBalances() di bawah
  // (nilai ABSOLUT — realtime useWallets menyusul dengan nilai yang sama).
  //
  // Kenapa bukan .delete()/.update() + adjustBalance seperti dulu:
  //  - baris milik orang lain di dompet bersama ditolak RLS sebagai 0 BARIS,
  //    bukan error → adjustBalance tetap jalan → saldo bergeser padahal
  //    transaksinya masih ada;
  //  - bekas anggota/viewer lolos DELETE (policy cuma cek user_id) tapi
  //    adjust_wallet_balance menolak mereka → baris hilang, saldo tidak dibalik.
  // RPC-nya memvalidasi `user_id = auth.uid()` dan RAISE kalau bukan milik
  // pemanggil, jadi kegagalan selalu berupa error, tidak pernah "sukses kosong".
  async function deleteTransactionInner(id) {
    // Dompet asal diambil SEBELUM RPC: kalau balasannya tidak membawa
    // wallet_id (bentuk jsonb lama), ini satu-satunya sumber id-nya.
    const walletId = transactions.find(t => t.id === id)?.wallet_id || null;
    const { data, error: err } = await supabase.rpc('delete_transaction', { p_transaction_id: id });
    if (err) {
      console.error('[useTransactions] delete_transaction FAILED:', err.code, err.message);
    } else {
      setTransactions(prev => prev.filter(t => t.id !== id));
      // 20260919000000 mengembalikan {wallet_id, balance} — saldo pasca-commit
      // dari RPC-nya sendiri, jadi dipakai langsung tanpa SELECT tambahan.
      if (data?.wallet_id && data.balance !== undefined && data.balance !== null) {
        syncBalances([data.wallet_id], [{ id: data.wallet_id, balance: data.balance }]);
      } else {
        syncBalances([walletId]);
      }
    }
    return { error: err };
  }

  async function updateTransactionInner(id, updates) {
    // Dompet ASAL dari state, sebelum RPC: saat transaksi dipindah dompet,
    // saldo dompet asal ikut berubah dan balasan RPC hanya membawa dompet baru.
    const oldWalletId = transactions.find(t => t.id === id)?.wallet_id || null;
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
    // Asal + tujuan (sama saja kalau tidak dipindah; syncBalances men-dedupe).
    syncBalances([oldWalletId, data.wallet_id]);
    return { error: null };
  }

  return {
    transactions, loading, error, refreshing,
    createTransaction, deleteTransaction, updateTransaction,
    // Refetch otomatis (dipakai pemicu foreground di app.jsx) vs pull-to-refresh
    // manual (tombol di halaman Transaksi). Sengaja dua nama berbeda: yang
    // pertama boleh di-skip diam-diam, yang kedua tidak pernah.
    autoRefetchTransactions, refreshTransactions,
  };
}
