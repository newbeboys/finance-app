-- ════════════════════════════════════════════════════
--  FinanceApp — Tabel Subscription (Basic / Pro)
--  Fase 1: status plan + pembatasan fitur (BELUM ada payment asli).
--  Jalankan seluruh file ini di Supabase SQL Editor.
-- ════════════════════════════════════════════════════

create table if not exists public.user_subscriptions (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  plan          text not null default 'basic' check (plan in ('basic','pro')),
  billing_cycle text check (billing_cycle in ('monthly','yearly')),
  started_at    timestamptz,
  expires_at    timestamptz,
  updated_at    timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users can view own subscription" on public.user_subscriptions;
create policy "Users can view own subscription"
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own subscription" on public.user_subscriptions;
create policy "Users can update own subscription"
  on public.user_subscriptions for update
  using (auth.uid() = user_id);

-- Trigger: setiap user baru otomatis dapat baris plan 'basic'
create or replace function public.handle_new_user_subscription()
returns trigger as $$
begin
  insert into public.user_subscriptions (user_id, plan)
  values (new.id, 'basic');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- Isi baris untuk user yang sudah ada sebelumnya
insert into public.user_subscriptions (user_id, plan)
select id, 'basic' from auth.users
where id not in (select user_id from public.user_subscriptions);
