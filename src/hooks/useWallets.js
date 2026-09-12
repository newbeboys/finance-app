import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { usePaywall } from '../components/PaywallModal';
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
  // State menyimpan SEMUA dompet yang boleh dilihat (milik + bersama). Tiga
  // array publik di bawah diturunkan dari sini — lihat catatan "PEMISAHAN
  // ARRAY" di dekat `return`.
  const [allAccounts, setAccounts]   = React.useState([]);
  const [memberCounts, setCounts]    = React.useState({});
  const [loading, setLoading]        = React.useState(true);
  // Dinaikkan oleh langganan realtime `wallet_members`. Menjalankan ULANG
  // seluruh effect, bukan sekadar menambal state — dan itu memang yang
  // dibutuhkan: kalau keanggotaan berubah, daftar id dompet bersama berubah,
  // dan filter realtime `id=in.(...)` di bawah harus dirakit ulang juga.
  const [reloadKey, setReloadKey]    = React.useState(0);
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

      // ── Jumlah anggota aktif per dompet MILIK SENDIRI ────────────────
      // Dipakai dua tempat di UI: lencana "3 anggota" di kartu dompet, dan
      // penjagaan tombol hapus (dompet yang masih punya anggota tidak boleh
      // dihapus — trigger 20260918000000 menolaknya di server juga).
      //
      // Cukup query biasa, tidak perlu RPC: policy "wallet_members: read own
      // or owned wallet" sudah mengizinkan owner membaca baris dompetnya.
      // Yang butuh RPC hanyalah IDENTITAS anggota (email/nama ada di
      // auth.users) — itu list_wallet_members di useWalletMembers.
      //
      // Kegagalan tidak dilempar, sejalan fetchSharedMemberships: tanpa angka
      // ini UI cuma kehilangan lencana, dompetnya sendiri tetap berfungsi.
      const ownedIds = (data || []).filter(r => r.user_id === userId).map(r => r.id);
      if (ownedIds.length) {
        const { data: memberRows, error: mErr } = await supabase
          .from('wallet_members')
          .select('wallet_id')
          .eq('status', 'active')
          .in('wallet_id', ownedIds);
        if (!alive) return;
        if (mErr) {
          console.error('[useWallets] member count FAILED:', mErr.code, mErr.message);
        } else {
          const counts = {};
          (memberRows || []).forEach(r => { counts[r.wallet_id] = (counts[r.wallet_id] || 0) + 1; });
          setCounts(counts);
        }
      } else {
        setCounts({});
      }

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

      // EMPAT binding di satu channel. Dompet sendiri disaring `user_id=eq.X`
      // supaya dompet yang dibuat SETELAH langganan ini tetap terpantau tanpa
      // perlu subscribe ulang. Dompet bersama tidak punya kolom yang bisa
      // dipakai begitu, jadi harus daftar id eksplisit — daftar itu memang
      // snapshot, TAPI binding ketiga di bawah membuatnya dirakit ulang setiap
      // kali keanggotaan user berubah, jadi keterbatasannya sudah tidak ada.
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

      // BINDING KETIGA — keanggotaan USER INI, di dompet mana pun.
      //
      // Ini yang memperbaiki keterbatasan yang dicatat di komentar binding
      // kedua: daftar `sharedIds` dirakit sekali saat effect jalan, jadi dompet
      // yang dibagikan ke user SETELAH itu dulu tidak terpantau sampai hook
      // mount ulang. Sekarang setiap perubahan baris keanggotaannya sendiri
      // menaikkan `reloadKey`, dan effect ini jalan ulang dari awal: memberships
      // diambil lagi, query dompet diulang, dan binding `id=in.(...)` dirakit
      // ulang dengan daftar yang baru.
      //
      // Mencakup tiga kejadian sekaligus: menerima undangan di device/tab lain,
      // dikeluarkan owner (remove_wallet_member → status 'left' → dompetnya
      // hilang dari daftar), dan keluar sendiri dari device lain. Ketiganya
      // UPDATE/INSERT pada baris ber-`user_id` user ini, jadi satu filter cukup.
      //
      // Sengaja memuat ulang penuh, bukan menambal state: peran bisa ikut
      // berubah (editor→viewer saat rejoin dengan kode lain), dan `canWrite`
      // yang salah jauh lebih berbahaya daripada satu query ekstra — dia
      // menentukan tombol edit/hapus transaksi mana yang ditawarkan.
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_members', filter: `user_id=eq.${userId}` },
        () => { if (alive) setReloadKey(k => k + 1); }
      );

      // BINDING KEEMPAT — anggota yang masuk/keluar dari dompet MILIK user ini,
      // supaya lencana "N anggota" dan penjagaan tombol hapus ikut segar.
      // Tidak bisa digabung dengan binding ketiga: yang itu menyaring
      // `user_id` = user ini, sedangkan baris anggota orang lain justru
      // ber-`user_id` orang lain. Penyaring yang cocok adalah wallet_id, dan
      // hanya untuk dompet yang benar-benar dimiliki user ini.
      if (ownedIds.length) {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'wallet_members', filter: `wallet_id=in.(${ownedIds.join(',')})` },
          () => { if (alive) setReloadKey(k => k + 1); }
        );
      }

      channel.subscribe();
    })();

    // channel bisa masih null kalau effect dibersihkan sebelum fetch selesai;
    // `alive` di atas yang mencegah subscribe-nya terlanjur jalan.
    return () => { alive = false; if (channel) supabase.removeChannel(channel); };
  }, [userId, reloadKey]);

  async function createAccount(a) {
    // ── Batas plan: tolak insert bila sudah mencapai limit ────────
    // `accounts` (MILIK SENDIRI), bukan `visibleAccounts`: keputusan Q4 Task 4
    // — dompet bersama tidak memakan jatah 1-dompet Basic. Sebelum pemisahan
    // array ini, seorang Basic yang diundang ke satu dompet teman langsung
    // kehabisan kuota dan tidak bisa membuat dompetnya sendiri.
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

    // Dompet yang masih punya anggota aktif ditolak trigger
    // trigger_wallets_block_delete_with_members (migrasi 20260918000000).
    // Ini penolakan yang WAJAR dan bisa ditindaklanjuti user, bukan kerusakan
    // — jadi dibedakan lewat `reason` supaya UI bisa bilang "keluarkan anggota
    // dulu" alih-alih pesan gagal generik.
    //
    // Dicocokkan lewat SQLSTATE, bukan teks pesan: teks di migrasi berbahasa
    // Indonesia dan tidak ikut i18n, sedangkan kodenya adalah kontrak.
    if (delErr?.code === '2BP01') {
      console.warn('[useWallets] deleteAccount ditolak: dompet masih punya anggota aktif');
      return { error: delErr, reason: 'has_members' };
    }

    const error = delErr || (data?.length ? null : notAffected('deleteAccount'));
    if (error) {
      console.error('[useWallets] deleteAccount FAILED:', error.message);
      return { error, reason: 'failed' };
    }
    setAccounts(prev => prev.filter(a => a.id !== id));
    return { error: null, reason: null };
  }

  // adjustBalance() (penyesuaian saldo terpisah lewat RPC adjust_wallet_balance)
  // SENGAJA DIHAPUS dari hook ini (Task 4, 11 Sep 2026). Semua perubahan saldo
  // kini menempel pada baris transaksinya di satu RPC atomik: record_transaction,
  // update_transaction, delete_transaction. Pola "tulis baris, lalu sesuaikan
  // saldo terpisah" adalah akar bug saldo dobel (11 Sep) DAN saldo korup di
  // dompet bersama (baris ditolak RLS sebagai 0 baris, adjustBalance tetap
  // jalan). Jangan dihidupkan lagi — kalau butuh operasi saldo baru, buat RPC
  // yang menurunkan delta dari baris datanya sendiri.

  // ════════════════════════════════════════════════════════════════════
  //  PEMISAHAN ARRAY (keputusan Q1/Q2/Q4 Task 4) — BACA SEBELUM MENGUBAH
  // ════════════════════════════════════════════════════════════════════
  //  Hook ini mengembalikan TIGA array dompet. Memilih yang salah TIDAK akan
  //  memunculkan error apa pun — bentuknya identik, isinya saja beda — jadi
  //  salah pilih hanya terlihat sebagai perilaku yang aneh. Karena itu setiap
  //  pemanggil harus sadar memilih:
  //
  //    accounts         MILIK SENDIRI saja.
  //                     Untuk KUOTA dan AGREGAT UANG. Dompet bersama tidak
  //                     boleh memakan jatah 1-dompet Basic (Q4: dompet bersama
  //                     adalah bonus, bukan kuota), dan saldo orang lain tidak
  //                     boleh masuk KPI/kekayaan bersih (Q2: dari sisi user,
  //                     seolah orang lain tidak ada — mereka pun tidak
  //                     menghitung saldo user ini).
  //
  //    visibleAccounts  milik + dompet bersama.
  //                     Untuk MENAMPILKAN dan MENCARI: daftar kartu dompet,
  //                     filter di Analitik/Budget/Laporan, dan — ini yang
  //                     paling kritis — pencarian `find(a => a.id === ...)`
  //                     di canEditTransaction/canDeleteTransaction. Memberi
  //                     `accounts` ke sana akan membuat editor dompet bersama
  //                     kehilangan tombol edit/hapus atas transaksinya sendiri,
  //                     karena dompetnya tidak ketemu → gagal tertutup.
  //
  //    writableAccounts milik + dompet bersama ber-peran editor.
  //                     Untuk setiap picker yang MENCATAT UANG (tambah
  //                     transaksi, transaksi berulang, hutang). Dompet viewer
  //                     akan ditolak record_transaction, jadi jangan pernah
  //                     ditawarkan.
  //
  //  Jangan memakai `accounts.length` sebagai penanda "user ini Pro" — dua hal
  //  yang berbeda. Status Pro dibaca dari useSubscription.
  // ════════════════════════════════════════════════════════════════════

  // memberCount ditempelkan di sini (turunan), bukan di dalam toAppWallet:
  // handler realtime saldo merakit ulang objek dompet dari payload dan akan
  // menghapus field apa pun yang tidak berasal dari baris `wallets`.
  const visibleAccounts = React.useMemo(
    () => allAccounts.map(a => ({ ...a, memberCount: memberCounts[a.id] || 0 })),
    [allAccounts, memberCounts]
  );
  const accounts         = React.useMemo(() => visibleAccounts.filter(a => !a.isShared), [visibleAccounts]);
  const writableAccounts = React.useMemo(() => visibleAccounts.filter(a => a.canWrite),  [visibleAccounts]);

  return { accounts, visibleAccounts, writableAccounts, loading, createAccount, setPrimary, deleteAccount };
}
