-- ============================================================
-- BAGIAN 1: Fix "Function Search Path Mutable" (3 warning) — set
-- search_path eksplisit untuk semua fungsi di schema public yang
-- belum di-set. Mencegah fungsi "ditipu" membaca objek dari schema
-- lain kalau search_path dimanipulasi pemanggil.
-- ============================================================
do $$
declare r record;
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%'
      )
  loop
    execute format('alter function public.%I(%s) set search_path = public, pg_temp', r.proname, r.args);
  end loop;
end $$;

-- ============================================================
-- BAGIAN 2: Trigger-only function — TIDAK PERNAH dipanggil langsung
-- oleh client, hanya jalan otomatis via trigger Postgres saat user baru
-- daftar. Cabut total akses eksekusi publik (trigger tetap jalan normal
-- tanpa grant ini, karena dieksekusi lewat mekanisme trigger, bukan
-- panggilan API biasa).
-- ============================================================
do $$
declare r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user_subscription'
  loop
    execute format('revoke execute on function public.handle_new_user_subscription(%s) from public, anon, authenticated', r.args);
  end loop;
end $$;

-- ============================================================
-- BAGIAN 3: RPC yang MEMANG dipanggil app dari user yang sudah login
-- (check_chat_rate_limit dari financial-chat, log_error dari
-- errorLogger.js, update_category_edit_cooldown dari EditCategoryModal).
-- Cabut dari PUBLIC & anon (tutup akses orang belum login), tetap
-- izinkan authenticated (app memang perlu ini).
-- ============================================================
do $$
declare r record; fn text;
begin
  foreach fn in array array['check_chat_rate_limit', 'log_error', 'update_category_edit_cooldown'] loop
    for r in
      select pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    loop
      execute format('revoke execute on function public.%I(%s) from public, anon', fn, r.args);
      execute format('grant execute on function public.%I(%s) to authenticated', fn, r.args);
    end loop;
  end loop;
end $$;

-- ============================================================
-- BAGIAN 4: KRITIS — set_plan_for_testing. Blocker keamanan yang sudah
-- lama ditandai: user bisa upgrade diri sendiri ke Pro gratis lewat
-- browser console. Cabut TOTAL dari authenticated, anon, PUBLIC.
-- Setelah ini, ubah plan untuk testing HANYA bisa lewat SQL Editor
-- sebagai admin.
-- ============================================================
do $$
declare r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_plan_for_testing'
  loop
    execute format('revoke execute on function public.set_plan_for_testing(%s) from public, anon, authenticated', r.args);
  end loop;
end $$;
