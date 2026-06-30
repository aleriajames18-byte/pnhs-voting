-- =====================================================================
-- Migration 0004: Seed election + DepEd SSLG positions
-- Adjust dates/title from the Admin > Election Settings screen later.
-- =====================================================================

insert into public.elections (title, starts_at, ends_at, is_active)
select 'PNHS Supreme Secondary Learner Government Elections 2026',
       now() + interval '1 day',
       now() + interval '2 days',
       true
where not exists (select 1 from public.elections where is_active);

-- Seed executive + grade-rep positions for the active election
with e as (select id from public.elections where is_active limit 1)
insert into public.positions (election_id, title, scope, grade_level, display_order)
select e.id, t.title, t.scope, t.grade_level, t.ord
from e,
(values
  ('President',                       'executive', null::int, 1),
  ('Vice President',                  'executive', null,      2),
  ('Secretary',                       'executive', null,      3),
  ('Treasurer',                       'executive', null,      4),
  ('Auditor',                         'executive', null,      5),
  ('Public Information Officer',      'executive', null,      6),
  ('Protocol Officer',                'executive', null,      7),
  ('Grade 7 Representative',          'grade_rep', 7,         8),
  ('Grade 8 Representative',          'grade_rep', 8,         9),
  ('Grade 9 Representative',          'grade_rep', 9,        10),
  ('Grade 10 Representative',         'grade_rep', 10,       11),
  ('Grade 11 Representative',         'grade_rep', 11,       12),
  ('Grade 12 Representative',         'grade_rep', 12,       13)
) as t(title, scope, grade_level, ord)
where not exists (
  select 1 from public.positions p where p.election_id = e.id
);
