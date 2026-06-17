-- ============================================================
-- Tabel: custom_categories
-- Kategori kustom buatan user, dipakai bersama oleh menu
-- Anggaran (budgets) dan Transaksi (transactions).
-- Jalankan SQL ini di Supabase → SQL Editor.
-- ============================================================

create table if not exists public.custom_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  color      text not null default 'var(--sage)',
  type       text not null default 'expense',     -- 'income' | 'expense'
  is_deleted boolean not null default false,     -- soft delete: set true saat user hapus
  created_at timestamptz not null default now()
);

-- Cegah kategori duplikat per user (case-insensitive: "Rokok" = "rokok")
create unique index if not exists custom_categories_user_name_unique
  on public.custom_categories (user_id, lower(name));

-- ── Row Level Security: tiap user hanya bisa lihat/ubah miliknya ──
alter table public.custom_categories enable row level security;

drop policy if exists "custom_categories_select_own" on public.custom_categories;
create policy "custom_categories_select_own"
  on public.custom_categories for select
  using (auth.uid() = user_id);

drop policy if exists "custom_categories_insert_own" on public.custom_categories;
create policy "custom_categories_insert_own"
  on public.custom_categories for insert
  with check (auth.uid() = user_id);

drop policy if exists "custom_categories_update_own" on public.custom_categories;
create policy "custom_categories_update_own"
  on public.custom_categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "custom_categories_delete_own" on public.custom_categories;
create policy "custom_categories_delete_own"
  on public.custom_categories for delete
  using (auth.uid() = user_id);

-- ── Aktifkan Realtime agar penambahan kategori langsung tersinkron
--    ke kedua menu tanpa perlu refresh ──
alter publication supabase_realtime add table public.custom_categories;
