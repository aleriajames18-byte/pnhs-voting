-- =====================================================================
-- Migration 0002: Row-Level Security
-- Principle: the browser uses the anon key; RLS is the real gatekeeper.
-- Privileged writes go through SECURITY DEFINER functions (0003) or the
-- service_role key inside Edge Functions only.
-- =====================================================================

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users a where a.id = auth.uid());
$$;

-- Enable RLS everywhere
alter table public.elections        enable row level security;
alter table public.positions        enable row level security;
alter table public.parties          enable row level security;
alter table public.candidates       enable row level security;
alter table public.voters           enable row level security;
alter table public.admin_users      enable row level security;
alter table public.votes            enable row level security;
alter table public.ballot_reset_log enable row level security;

-- ---------------- elections ----------------
-- Everyone (even anon) may read the active election so the UI knows the window.
create policy elections_read_all on public.elections
  for select using (true);
create policy elections_admin_write on public.elections
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- positions / parties / candidates ----------------
-- Public read (needed to render the ballot and results).
create policy positions_read_all on public.positions
  for select using (true);
create policy positions_admin_write on public.positions
  for all using (public.is_admin()) with check (public.is_admin());

create policy parties_read_all on public.parties
  for select using (true);
create policy parties_admin_write on public.parties
  for all using (public.is_admin()) with check (public.is_admin());

create policy candidates_read_all on public.candidates
  for select using (true);
create policy candidates_admin_write on public.candidates
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- voters ----------------
-- A voter can read ONLY their own row. Admins read all.
create policy voters_self_read on public.voters
  for select using (id = auth.uid() or public.is_admin());
-- Direct writes by voters are disallowed (has_voted only changes via cast_ballot).
create policy voters_admin_write on public.voters
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- admin_users ----------------
create policy admins_self_read on public.admin_users
  for select using (id = auth.uid());

-- ---------------- votes ----------------
-- SECRECY: no direct SELECT for anyone via the API. Tallies come only from
-- SECURITY DEFINER functions in 0003. No client INSERT/UPDATE/DELETE either.
-- (No policies created => RLS denies all direct access by default.)

-- ---------------- ballot_reset_log ----------------
create policy reset_log_admin_read on public.ballot_reset_log
  for select using (public.is_admin());
