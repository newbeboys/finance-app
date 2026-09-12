import React from 'react';
import { supabase } from '../supabase';

/**
 * Hook aksi keanggotaan dompet bersama (Fitur B, Task 4).
 *
 * Membungkus empat RPC Task 3 (generate_wallet_invite, accept_wallet_invite,
 * leave_wallet, remove_wallet_member) + list_wallet_members (Task 4).
 *
 * ┌─ MASALAH YANG DISELESAIKAN HOOK INI: DUA KONTRAK ERROR ─────────────────┐
 * │ RPC-RPC itu TIDAK seragam cara menolaknya, dan itu disengaja:           │
 * │                                                                         │
 * │   accept_wallet_invite  → RETURNS jsonb {ok, reason?}. TIDAK PERNAH     │
 * │       melempar untuk kegagalan yang diantisipasi. Bentuk ini WAJIB:     │
 * │       dia menaikkan penghitung rate limit sebelum memutuskan, dan RAISE │
 * │       akan me-rollback penghitung itu — persis bug yang diperbaiki      │
 * │       migrasi 20260914000000.                                           │
 * │   generate / leave / remove → RAISE EXCEPTION. Tidak menulis apa pun    │
 * │       di jalur penolakan, jadi rollback tidak menghilangkan apa-apa.    │
 * │                                                                         │
 * │ Kalau perbedaan ini dibiarkan bocor ke komponen, tiap tombol harus tahu │
 * │ RPC-nya bergaya yang mana — dan satu saja yang lupa memeriksa `ok` akan │
 * │ menampilkan "berhasil" untuk kode yang sebenarnya ditolak. Karena itu   │
 * │ SEMUA aksi di sini dinormalkan ke satu bentuk:                          │
 * │                                                                         │
 * │     { ok: boolean, reason: string|null, data: object|null }             │
 * │                                                                         │
 * │ Komponen cukup memeriksa `ok`, lalu memetakan `reason` ke satu pesan.   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * @param {string|null} walletId dompet yang daftar anggotanya sedang dibuka
 *   (MemberListSheet). null = tidak ada yang dibuka: tidak fetch, tidak
 *   subscribe. Aksi-aksinya tetap bisa dipanggil tanpa ini.
 */
export function useWalletMembers(walletId) {
  const [members, setMembers]     = React.useState([]);
  const [loading, setLoading]     = React.useState(false);
  const [listError, setListError] = React.useState(null);

  // Status sibuk PER AKSI, bukan satu boolean global. MemberListSheet bisa
  // menampilkan banyak tombol "Keluarkan" sekaligus; satu boolean bersama akan
  // membuat SEMUA baris tampak sedang diproses saat satu diklik, dan user tidak
  // bisa tahu mana yang benar-benar jalan. `removingUserId` menyimpan siapa,
  // bukan sekadar apakah.
  const [busy, setBusy] = React.useState({
    generating:    false,
    accepting:     false,
    leaving:       false,
    removingUserId: null,
  });

  const setFlag = (key, value) => setBusy(prev => ({ ...prev, [key]: value }));

  // ── Pemuatan daftar anggota ────────────────────────────────────────
  // Dipisah dari useEffect supaya bisa dipanggil ulang dari handler realtime
  // DAN setelah aksi remove — keduanya butuh daftar yang sama.
  //
  // `ref` dipakai agar identitas fungsi ini stabil (tidak masuk dependency
  // useEffect dan memicu subscribe ulang tiap render).
  const walletIdRef = React.useRef(walletId);
  walletIdRef.current = walletId;

  const refreshMembers = React.useCallback(async () => {
    const id = walletIdRef.current;
    if (!id) { setMembers([]); return; }

    setLoading(true);
    const { data, error } = await supabase.rpc('list_wallet_members', { p_wallet_id: id });

    // Balapan: sheet sudah ditutup / berpindah dompet selagi request jalan.
    // Hasil yang datang terlambat tidak boleh menimpa state dompet lain.
    if (walletIdRef.current !== id) return;

    if (error) {
      console.error('[useWalletMembers] list_wallet_members FAILED:', error.code, error.message);
      setListError(error);
      setMembers([]);
    } else {
      setListError(null);
      setMembers((data || []).map(r => ({
        userId:      r.user_id,
        email:       r.email || '',
        // Nama tampilan boleh kosong (user daftar tanpa mengisi nama). Jatuh
        // ke bagian lokal email, pola yang sama dengan topbar.jsx.
        displayName: r.display_name || (r.email ? r.email.split('@')[0] : ''),
        role:        r.role,
        joinedAt:    r.joined_at,
        isOwner:     r.is_owner === true,
      })));
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (!walletId) { setMembers([]); setListError(null); return; }

    let alive = true;
    refreshMembers();

    // Channel berumur-sheet: dibuka saat daftar anggota dibuka, ditutup saat
    // ditutup. Sengaja TIDAK digabung ke channel useWallets — yang di sana
    // memantau keanggotaan USER INI di dompet mana pun (agar daftar dompetnya
    // tidak basi), sedangkan yang ini memantau SEMUA anggota SATU dompet.
    // Beda cakupan, beda umur.
    const channel = supabase
      .channel(`wallet_members_sheet:${walletId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_members', filter: `wallet_id=eq.${walletId}` },
        () => { if (alive) refreshMembers(); }
      )
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [walletId, refreshMembers]);

  // ── Penerjemah error RPC bergaya RAISE ─────────────────────────────
  //
  // Ketiga RPC itu memakai ERRCODE 42501 untuk beberapa sebab berbeda, jadi
  // kode saja tidak cukup untuk membedakan "bukan Pro" dari "bukan owner".
  // Pembeda satu-satunya adalah teks pesannya.
  //
  // Mencocokkan teks pesan biasanya rapuh — di sini tidak, DAN ini disengaja:
  // pesan-pesan itu literal Bahasa Indonesia yang ditulis di dalam file
  // migrasi dan TIDAK pernah diterjemahkan (i18n hanya di klien). Yang
  // ditampilkan ke user bukan pesan ini, melainkan hasil pemetaan `reason` di
  // komponen. Kalau suatu saat pesan di migrasi diubah, penyesuaiannya di
  // fungsi ini saja.
  function reasonFromRaise(error) {
    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('tidak ada sesi login'))   return 'no_session';
    if (msg.includes('khusus pengguna pro'))    return 'not_pro';
    if (msg.includes('hanya owner'))            return 'not_owner';
    if (msg.includes('bukan milikmu'))          return 'not_owner';
    if (msg.includes('bukan anggota aktif'))    return 'not_member';
    if (msg.includes('anggota tidak ditemukan'))return 'member_gone';
    if (msg.includes('tidak punya akses'))      return 'no_access';
    return 'unknown';
  }

  const fail = (reason) => ({ ok: false, reason, data: null });
  const done = (data)   => ({ ok: true,  reason: null, data: data ?? null });

  // ── generate_wallet_invite ─────────────────────────────────────────
  // Gate Pro dicek DI DALAM RPC (bukan di planLimits saja) karena melewatinya
  // memberi akses permanen ke akun ketiga — lihat keputusan produk #1 di
  // migrasi 20260913000000. Klien tetap menyembunyikan tombolnya untuk Basic;
  // ini lapis keduanya, dan `not_pro` di sini artinya lapis pertama bocor.
  async function generateInviteCode(targetWalletId, role = 'editor') {
    if (!targetWalletId) return fail('unknown');
    setFlag('generating', true);
    const { data, error } = await supabase.rpc('generate_wallet_invite', {
      p_wallet_id: targetWalletId,
      p_role:      role,
    });
    setFlag('generating', false);

    if (error) {
      console.error('[useWalletMembers] generate_wallet_invite FAILED:', error.code, error.message);
      return fail(reasonFromRaise(error));
    }
    // RETURNS TABLE(code, expires_at) → PostgREST mengirimnya sebagai array
    // berisi satu baris, bukan objek. Mengambil [0] tanpa memeriksa panjangnya
    // akan menghasilkan `undefined.code` kalau suatu saat RPC-nya berubah.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.code) {
      console.error('[useWalletMembers] generate_wallet_invite: balasan tanpa kode', data);
      return fail('unknown');
    }
    return done({ code: row.code, expiresAt: row.expires_at });
  }

  // ── accept_wallet_invite ───────────────────────────────────────────
  // Satu-satunya yang balasannya jsonb. `error` di sini berarti hal yang
  // benar-benar tak terduga (jaringan, tidak ada sesi) — semua penolakan
  // normal datang sebagai {ok:false, reason}.
  async function acceptInviteCode(rawCode) {
    // Trim wajib: user menempel kode dari WhatsApp sering membawa spasi/newline.
    const code = String(rawCode ?? '').trim();
    // Validasi bentuk di klien supaya tebakan yang jelas-jelas salah tidak
    // menghabiskan jatah rate limit (10 per 15 menit) — jatah itu milik user
    // yang sah juga, bukan cuma penyerang.
    if (!/^\d{6}$/.test(code)) return fail('invalid_format');

    setFlag('accepting', true);
    const { data, error } = await supabase.rpc('accept_wallet_invite', { p_code: code });
    setFlag('accepting', false);

    if (error) {
      console.error('[useWalletMembers] accept_wallet_invite FAILED:', error.code, error.message);
      return fail(reasonFromRaise(error));
    }
    // Kontrak jsonb migrasi 20260915000000: {ok, wallet_id?, role?, reason?}.
    // Memeriksa `ok` WAJIB — tanpa itu, kode yang ditolak akan tampak sukses.
    if (!data?.ok) {
      return {
        ok: false,
        reason: data?.reason || 'unknown',
        // rate_limited membawa reset_at; diteruskan apa adanya supaya komponen
        // bisa menampilkan sisa waktunya. Jangan pernah menghitung sendiri
        // kapan jendelanya habis — servernya yang menentukan.
        data: data?.reset_at ? { resetAt: data.reset_at } : null,
      };
    }
    return done({ walletId: data.wallet_id, role: data.role });
  }

  // ── leave_wallet ───────────────────────────────────────────────────
  async function leaveWallet(targetWalletId) {
    if (!targetWalletId) return fail('unknown');
    setFlag('leaving', true);
    const { error } = await supabase.rpc('leave_wallet', { p_wallet_id: targetWalletId });
    setFlag('leaving', false);

    if (error) {
      console.error('[useWalletMembers] leave_wallet FAILED:', error.code, error.message);
      return fail(reasonFromRaise(error));
    }
    return done();
  }

  // ── remove_wallet_member ───────────────────────────────────────────
  async function removeMember(targetWalletId, targetUserId) {
    if (!targetWalletId || !targetUserId) return fail('unknown');
    setFlag('removingUserId', targetUserId);
    const { error } = await supabase.rpc('remove_wallet_member', {
      p_wallet_id: targetWalletId,
      p_user_id:   targetUserId,
    });
    setFlag('removingUserId', null);

    if (error) {
      console.error('[useWalletMembers] remove_wallet_member FAILED:', error.code, error.message);
      return fail(reasonFromRaise(error));
    }
    // Realtime wallet_members akan memicu refreshMembers juga, tapi jangan
    // diandalkan: kalau langganannya putus, daftar akan tetap menampilkan
    // orang yang baru saja dikeluarkan. Refresh eksplisit membuat hasilnya
    // benar tanpa bergantung pada realtime (idempoten kalau keduanya jalan).
    refreshMembers();
    return done();
  }

  return {
    members,
    membersLoading: loading,
    membersError:   listError,
    busy,
    refreshMembers,
    generateInviteCode,
    acceptInviteCode,
    leaveWallet,
    removeMember,
  };
}
