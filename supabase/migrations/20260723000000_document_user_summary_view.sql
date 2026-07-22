-- Migration: Dokumentasi resmi view `user_summary` (referensi manual admin —
-- daftar user + ringkasan saldo/pemasukan/pengeluaran bulan berjalan)
--
-- Riwayat: View ini sudah ada di production sejak ~pertengahan Juni 2026, dibuat
-- langsung via SQL Editor tanpa pernah tercatat sebagai migration file. Dikonfirmasi
-- via grep codebase (22 Jul 2026): TIDAK dipanggil oleh kode aplikasi manapun —
-- murni referensi manual admin.
--
-- Security Advisor (22 Jul 2026) sempat menandai 2 isu kritis:
--   1. "Security Definer View" — view berjalan dengan hak akses pembuat (admin),
--      melompati RLS tabel di baliknya.
--   2. "Exposed Auth Users" — bisa diakses anon/authenticated lewat Data API
--      publik, dan menyentuh data auth.users (email tiap pengguna).
-- Kedua isu sudah diperbaiki manual di SQL Editor sebelum migration ini dibuat.
-- Definisi di bawah adalah SALINAN PERSIS dari yang live di production per 23 Jul 2026.
--
-- CATATAN AKURASI (non-security, tidak diperbaiki di sini): filter "bulan ini"
-- pakai created_at (UTC), bukan kolom date (lokal WIB) sesuai konvensi project.
-- Bisa meleset di sekitar pergantian bulan. Aman diabaikan karena view ini
-- referensi internal saja, bukan data yang tampil ke user.

create or replace view public.user_summary
with (security_invoker = on) as
select
  u.id as user_id,
  u.email,
  coalesce(sum(t.amount), 0::numeric) as total_saldo_dompet,
  coalesce(
    sum(
      case
        when t.type = 'income'::text
         and date_trunc('month'::text, t.created_at) = date_trunc('month'::text, now())
        then t.amount
        else 0::numeric
      end
    ), 0::numeric
  ) as total_pemasukan_bulan_ini,
  coalesce(
    abs(
      sum(
        case
          when t.type = 'expense'::text
           and date_trunc('month'::text, t.created_at) = date_trunc('month'::text, now())
          then t.amount
          else 0::numeric
        end
      )
    ), 0::numeric
  ) as total_pengeluaran_bulan_ini
from auth.users u
left join transactions t on t.user_id = u.id
group by u.id, u.email;

revoke all on public.user_summary from anon, authenticated;
