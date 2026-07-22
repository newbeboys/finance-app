-- rls_auto_enable adalah event trigger function (auto-enable RLS pada tabel
-- baru), bukan RPC yang dipanggil app. Postgres sendiri menolak pemanggilan
-- langsung fungsi RETURNS event_trigger, jadi ini murni hygiene fix untuk
-- membersihkan warning linter, tidak ada risiko fungsional.
do $$
declare r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  loop
    execute format('revoke execute on function public.rls_auto_enable(%s) from public, anon, authenticated', r.args);
  end loop;
end $$;
