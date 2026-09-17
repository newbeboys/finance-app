-- ════════════════════════════════════════════════════
--  FinanceApp — Kolom infrastruktur: timezone per-user
--
--  MURNI INFRASTRUKTUR. Kolom ini BELUM dipakai kode manapun saat
--  migration ini ditulis — tidak ada client (src/), edge function
--  (supabase/functions/), atau RPC yang membaca atau menulisnya.
--  Tidak ada perubahan perilaku apa pun dari migration ini.
--
--  KENAPA KOLOM INI ADA:
--  Investigasi `docs/investigasi-timezone-2026-09-16.md` memetakan
--  bahwa SELURUH aplikasi (client, edge function financial-chat, dan
--  beberapa RPC seperti create_debt di 20260921000000) hardcode
--  asumsi timezone WIB (UTC+7 / Asia/Jakarta) untuk menghitung "hari
--  ini"/"bulan ini"/rentang tanggal — dan bahwa TIDAK ADA satu pun
--  tempat di skema database yang bisa menyimpan preferensi timezone
--  user, sehingga mendukung timezone lain (kalau nanti diputuskan)
--  tidak punya sumber data untuk dibaca sama sekali.
--
--  Kolom ini menyiapkan sumber itu di tabel yang sudah per-user
--  (user_subscriptions, satu baris per user_id) TANPA mengaktifkan
--  perilaku apa pun — keputusan produk soal DARI MANA nilai kolom ini
--  diisi (device locale saat runtime? pilihan manual user? terikat
--  lokasi akun?) dan KAPAN kode mulai membacanya belum diambil, dan
--  itu di luar cakupan migration ini.
--
--  DEFAULT 'Asia/Jakarta': seluruh baris existing (dan baris baru yang
--  dibuat lewat trigger handle_new_user_subscription /
--  create_wallet dkk yang INSERT ON CONFLICT DO NOTHING) tetap
--  konsisten dengan asumsi WIB yang sudah berlaku implisit di seluruh
--  kode saat ini — kolom baru TIDAK mengubah "kebenaran" apa pun
--  untuk baris yang sudah ada.
--
--  RLS: TIDAK disentuh. Kolom baru otomatis ikut policy SELECT/UPDATE
--  existing di user_subscriptions (subscriptions.sql:18-26), yang
--  sudah scoped `auth.uid() = user_id` — tidak perlu policy baru
--  untuk satu kolom tambahan di tabel yang sama.
-- ════════════════════════════════════════════════════

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Jakarta';

COMMENT ON COLUMN public.user_subscriptions.timezone IS
  'Infrastruktur untuk dukungan timezone selain WIB (lihat docs/investigasi-timezone-2026-09-16.md). BELUM dipakai kode manapun (client/edge function/RPC) per migration ini — murni kolom siap-pakai, default Asia/Jakarta agar konsisten dengan asumsi WIB yang sudah berlaku implisit di seluruh aplikasi saat ini.';
