-- ════════════════════════════════════════════════════
--  FinanceApp — Fitur B (dompet bersama), Tahap 4 (UI): dua hal yang
--  dibutuhkan klien tapi tidak bisa dikerjakan dari sisi klien.
--
--  1. GUARD HAPUS DOMPET (keputusan Q3 Task 4). Sampai migrasi ini, policy
--     "wallets: delete own" mengizinkan owner MENGHAPUS dompet tanpa syarat,
--     dan wallet_members.wallet_id punya ON DELETE CASCADE — jadi menghapus
--     dompet yang sedang dibagikan akan MENGHAPUS KEANGGOTAAN ORANG LAIN
--     secara diam-diam, tanpa mereka pernah diberi tahu. Transaksi yang
--     sudah mereka catat ikut lenyap (transactions.wallet_id juga cascade).
--     Q3 memutuskan penjagaan ini ada di SERVER, bukan cuma tombol UI yang
--     di-disable: klien mana pun (atau panggilan PostgREST langsung) harus
--     terkena aturan yang sama.
--
--  2. list_wallet_members() — daftar anggota BESERTA identitasnya. Klien
--     tidak bisa menyusun ini sendiri: wallet_members hanya menyimpan
--     user_id (uuid), dan auth.users tidak bisa dibaca dari klien untuk
--     user LAIN. Tanpa RPC ini, MemberListSheet hanya bisa menampilkan uuid
--     mentah dan owner tidak punya cara tahu siapa yang sedang dia keluarkan.
--
--  PERUBAHAN KEPUTUSAN YANG DICATAT DI SINI:
--     Migrasi 20260912000000 menulis pada policy SELECT wallet_members:
--     "member TIDAK bisa melihat daftar member lain — dicatat sebagai
--     keputusan Task 4, sengaja belum dilonggarkan." Task 4 kini
--     MELONGGARKANNYA, tapi HANYA lewat RPC di bawah, bukan dengan mengubah
--     policy. Alasannya: yang boleh dilihat sesama anggota adalah daftar
--     yang sudah dikurasi (uuid, email, nama, peran, status aktif) — bukan
--     akses SELECT bebas ke barisnya, yang juga akan membocorkan invited_by
--     dan riwayat status='left' orang lain. RPC memberi kontrol itu; policy
--     tidak. Policy SELECT sengaja dibiarkan apa adanya.
-- ════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════
--  BAGIAN 1 — Guard hapus dompet yang masih punya anggota aktif
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.wallets_block_delete_with_members()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- ┌─ KENAPA CEK "OWNER MASIH ADA" INI WAJIB ADA DULUAN ──────────────────┐
  -- │ wallets.user_id REFERENCES auth.users(id) ON DELETE CASCADE. Jadi    │
  -- │ menghapus AKUN akan meng-cascade ke penghapusan semua dompetnya, dan │
  -- │ cascade itu ikut memicu trigger ini. Tanpa cabang di bawah, seorang  │
  -- │ owner yang punya dompet bersama TIDAK AKAN BISA DIHAPUS AKUNNYA —    │
  -- │ exception di sini membatalkan seluruh transaksi penghapusan user.    │
  -- │ Itu bukan sekadar merepotkan: penghapusan data atas permintaan user  │
  -- │ adalah kewajiban (Play Store data deletion), dan kegagalannya akan   │
  -- │ muncul sebagai error tak terbaca di dashboard Supabase.              │
  -- │                                                                      │
  -- │ Cara membedakannya: ON DELETE CASCADE di Postgres diimplementasikan  │
  -- │ sebagai trigger AFTER DELETE pada tabel INDUK, jadi saat DELETE anak │
  -- │ ini berjalan, baris auth.users-nya SUDAH hilang di dalam transaksi   │
  -- │ yang sama. Sebaliknya, saat user menghapus satu dompet lewat aplikasi│
  -- │ barisnya jelas masih ada. Jadi "owner sudah tidak ada" = ini cascade │
  -- │ penghapusan akun, dan guard tidak boleh ikut campur.                 │
  -- └──────────────────────────────────────────────────────────────────────┘
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id) THEN
    RETURN OLD;
  END IF;

  -- status='left' TIDAK menghalangi: orangnya memang sudah keluar. 'pending'
  -- juga tidak — alur Task 3 tidak pernah membuat baris 'pending' (kode
  -- langsung jadi 'active' saat diterima), jadi baris seperti itu tidak
  -- mewakili siapa pun yang sedang memakai dompet ini.
  IF EXISTS (
    SELECT 1 FROM public.wallet_members m
    WHERE m.wallet_id = OLD.id AND m.status = 'active'
  ) THEN
    -- SQLSTATE dipilih spesifik supaya klien bisa memetakannya ke pesan
    -- "keluarkan anggota dulu" tanpa mencocokkan teks pesan (yang akan
    -- rusak begitu pesannya diterjemahkan). PostgREST meneruskan SQLSTATE
    -- ini apa adanya sebagai `error.code`.
    RAISE EXCEPTION 'wallets: dompet masih punya anggota aktif, keluarkan semua anggota sebelum menghapus'
      USING ERRCODE = '2BP01';   -- dependent_objects_still_exist
  END IF;

  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wallets_block_delete_with_members() FROM public, anon;

COMMENT ON FUNCTION public.wallets_block_delete_with_members() IS
  'Trigger BEFORE DELETE wallets: menolak penghapusan dompet yang masih punya anggota aktif (keputusan Q3 Task 4), supaya ON DELETE CASCADE wallet_members/transactions tidak menghapus keanggotaan dan transaksi orang lain diam-diam. SENGAJA melewatkan cascade dari penghapusan akun owner (dideteksi dari auth.users yang sudah tidak ada) — kalau tidak, akun owner dompet bersama tidak akan pernah bisa dihapus.';

DROP TRIGGER IF EXISTS trigger_wallets_block_delete_with_members ON public.wallets;
CREATE TRIGGER trigger_wallets_block_delete_with_members
  BEFORE DELETE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.wallets_block_delete_with_members();


-- ════════════════════════════════════════════════════
--  BAGIAN 2 — list_wallet_members
-- ════════════════════════════════════════════════════
--  SECURITY DEFINER karena harus membaca auth.users, yang tidak terjangkau
--  role `authenticated`. Konsekuensinya body ini melewati RLS, jadi gerbang
--  aksesnya HARUS diperiksa eksplisit di baris pertama — sama seperti
--  generate_wallet_invite dan remove_wallet_member.
--
--  APA YANG DIBOCORKAN, DAN KE SIAPA: email + nama tampilan sesama anggota
--  dompet yang sama. Batas ini disengaja — mereka sudah saling bertukar kode
--  undangan 6 digit di luar aplikasi, jadi sudah saling kenal. Orang di luar
--  dompet (wallet_access_role NULL) tidak mendapat apa pun.
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.list_wallet_members(p_wallet_id uuid)
RETURNS TABLE(
  user_id      uuid,
  email        text,
  display_name text,
  role         text,
  joined_at    timestamptz,
  is_owner     boolean
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text := public.wallet_access_role(p_wallet_id);
BEGIN
  -- Owner, editor, dan viewer sama-sama boleh melihat daftar. Viewer memang
  -- tidak bisa MENGUBAH apa pun, tapi dia berhak tahu siapa lagi yang bisa
  -- melihat catatan keuangan yang sama.
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'list_wallet_members: dompet tidak ditemukan atau kamu tidak punya akses'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  -- Baris OWNER disintesis dari wallets.user_id, BUKAN dibaca dari
  -- wallet_members — owner memang tidak punya baris di sana (invariant Task 2,
  -- dijaga migrasi 20260915000000). Menambahkannya di sini murni untuk
  -- tampilan: anggota yang membuka daftar perlu tahu ini dompet siapa.
  SELECT
    w.user_id,
    u.email::text,
    NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), '')::text,
    'owner'::text,
    w.created_at,
    true
  FROM public.wallets w
  JOIN auth.users u ON u.id = w.user_id
  WHERE w.id = p_wallet_id

  UNION ALL

  -- Hanya status='active'. 'left' sengaja tidak ditampilkan (BAGIAN 5 brief
  -- Task 4): barisnya disimpan untuk riwayat, bukan untuk dilihat sebagai
  -- anggota. 'pending' tidak pernah dihasilkan alur Task 3.
  SELECT
    m.user_id,
    u.email::text,
    NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), '')::text,
    m.role,
    m.joined_at,
    false
  FROM public.wallet_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.wallet_id = p_wallet_id
    AND m.status    = 'active'

  -- Owner selalu di atas (is_owner DESC), sisanya urut waktu bergabung.
  ORDER BY 6 DESC, 5 ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_wallet_members(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.list_wallet_members(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_wallet_members(uuid) IS
  'Daftar anggota AKTIF sebuah dompet bersama beserta email dan nama tampilannya, plus satu baris sintetis untuk owner (is_owner=true, diambil dari wallets.user_id karena owner tidak punya baris di wallet_members). Boleh dipanggil siapa pun yang punya akses ke dompet itu (owner/editor/viewer) — melonggarkan catatan "member tidak bisa melihat member lain" di migrasi 20260912000000, tapi lewat RPC terkurasi, bukan dengan melonggarkan policy SELECT. SECURITY DEFINER karena auth.users tidak terjangkau role authenticated.';
