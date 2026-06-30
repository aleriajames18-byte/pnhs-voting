-- =====================================================================
-- Polanco National High School — Online Voting System
-- Migration 0001: Core schema
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- elections : one active election at a time
-- ---------------------------------------------------------------------
create table if not exists public.elections (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  results_published boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Guarantee at most one active election
create unique index if not exists one_active_election
  on public.elections (is_active) where is_active;

-- ---------------------------------------------------------------------
-- positions
-- ---------------------------------------------------------------------
create table if not exists public.positions (
  id             uuid primary key default gen_random_uuid(),
  election_id    uuid not null references public.elections(id) on delete cascade,
  title          text not null,
  scope          text not null check (scope in ('executive','grade_rep')),
  grade_level    int,                       -- required when scope = 'grade_rep'
  max_selections int not null default 1,
  display_order  int not null default 0,
  check (scope = 'executive' or grade_level is not null)
);

-- ---------------------------------------------------------------------
-- parties (slates)
-- ---------------------------------------------------------------------
create table if not exists public.parties (
  id          uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  name        text not null,
  color       text
);

-- ---------------------------------------------------------------------
-- candidates
-- ---------------------------------------------------------------------
create table if not exists public.candidates (
  id            uuid primary key default gen_random_uuid(),
  position_id   uuid not null references public.positions(id) on delete cascade,
  party_id      uuid references public.parties(id) on delete set null,
  full_name     text not null,
  photo_url     text,
  display_order int not null default 0
);

-- ---------------------------------------------------------------------
-- voters : profile row, id == auth.users.id
-- ---------------------------------------------------------------------
create table if not exists public.voters (
  id          uuid primary key references auth.users(id) on delete cascade,
  lrn         text not null unique,
  full_name   text not null,
  grade_level int not null,
  section     text not null,
  has_voted   boolean not null default false,
  voted_at    timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- admin_users : id == auth.users.id
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  id    uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role  text not null default 'super_admin'
);

-- ---------------------------------------------------------------------
-- votes : carries voter_id ONLY for dedup + Reset Ballot.
--         Never joined to identity in any tally/report.
-- ---------------------------------------------------------------------
create table if not exists public.votes (
  id           uuid primary key default gen_random_uuid(),
  election_id  uuid not null references public.elections(id) on delete cascade,
  voter_id     uuid not null references public.voters(id) on delete cascade,
  position_id  uuid not null references public.positions(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete set null, -- NULL = abstain
  created_at   timestamptz not null default now(),
  unique (voter_id, position_id)
);

create index if not exists votes_position_idx on public.votes(position_id);
create index if not exists votes_candidate_idx on public.votes(candidate_id);

-- ---------------------------------------------------------------------
-- ballot_reset_log : audit trail for the Reset Ballot override
-- ---------------------------------------------------------------------
create table if not exists public.ballot_reset_log (
  id         uuid primary key default gen_random_uuid(),
  voter_lrn  text not null,
  reset_by   uuid references public.admin_users(id),
  reason     text,
  created_at timestamptz not null default now()
);
