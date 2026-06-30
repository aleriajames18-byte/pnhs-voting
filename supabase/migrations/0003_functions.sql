-- =====================================================================
-- Migration 0003: Secure RPC functions (the only write path to votes)
-- =====================================================================

-- ---------------------------------------------------------------------
-- cast_ballot(p_selections)
--   p_selections = jsonb array of { "position_id": uuid, "candidate_id": uuid|null }
--   Atomic: validates window + eligibility + not-yet-voted, inserts votes,
--   then locks the voter. NULL candidate_id = Abstain.
-- ---------------------------------------------------------------------
create or replace function public.cast_ballot(p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter    public.voters%rowtype;
  v_election public.elections%rowtype;
  v_sel      jsonb;
  v_pos      public.positions%rowtype;
  v_cand_id  uuid;
begin
  -- Identify + lock the voter row
  select * into v_voter from public.voters where id = auth.uid() for update;
  if not found then
    raise exception 'NOT_A_VOTER';
  end if;
  if v_voter.has_voted then
    raise exception 'ALREADY_VOTED';
  end if;

  -- Active election + window check
  select * into v_election from public.elections where is_active limit 1;
  if not found then
    raise exception 'NO_ACTIVE_ELECTION';
  end if;
  if now() < v_election.starts_at then
    raise exception 'VOTING_NOT_STARTED';
  end if;
  if now() > v_election.ends_at then
    raise exception 'VOTING_CLOSED';
  end if;

  -- Validate + insert each selection
  for v_sel in select * from jsonb_array_elements(p_selections)
  loop
    select * into v_pos from public.positions
      where id = (v_sel->>'position_id')::uuid
        and election_id = v_election.id;
    if not found then
      raise exception 'INVALID_POSITION';
    end if;

    -- Eligibility: executive for everyone; grade_rep only for own grade
    if v_pos.scope = 'grade_rep' and v_pos.grade_level <> v_voter.grade_level then
      raise exception 'INELIGIBLE_POSITION';
    end if;

    v_cand_id := nullif(v_sel->>'candidate_id','')::uuid;

    -- If a candidate is chosen, it must belong to this position
    if v_cand_id is not null then
      perform 1 from public.candidates
        where id = v_cand_id and position_id = v_pos.id;
      if not found then
        raise exception 'INVALID_CANDIDATE';
      end if;
    end if;

    insert into public.votes (election_id, voter_id, position_id, candidate_id)
    values (v_election.id, v_voter.id, v_pos.id, v_cand_id);
  end loop;

  -- Lock the voter
  update public.voters
    set has_voted = true, voted_at = now()
    where id = v_voter.id;

  return jsonb_build_object('status','ok');
end;
$$;

-- ---------------------------------------------------------------------
-- reset_ballot(p_lrn, p_reason)  [admin only]
--   Deletes a voter's votes, clears has_voted, writes an audit log entry.
--   Never returns ballot contents.
-- ---------------------------------------------------------------------
create or replace function public.reset_ballot(p_lrn text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter public.voters%rowtype;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into v_voter from public.voters where lrn = p_lrn for update;
  if not found then
    raise exception 'VOTER_NOT_FOUND';
  end if;

  delete from public.votes where voter_id = v_voter.id;
  update public.voters set has_voted = false, voted_at = null where id = v_voter.id;

  insert into public.ballot_reset_log (voter_lrn, reset_by, reason)
  values (p_lrn, auth.uid(), p_reason);

  return jsonb_build_object('status','ok','lrn',p_lrn);
end;
$$;

-- ---------------------------------------------------------------------
-- get_results()  -> tallies
--   Visible to admins anytime; to the public only after results_published.
--   Abstain shown as candidate_name = 'Abstain'.
-- ---------------------------------------------------------------------
create or replace function public.get_results()
returns table (
  position_id    uuid,
  position_title text,
  scope          text,
  grade_level    int,
  candidate_id   uuid,
  candidate_name text,
  party_name     text,
  votes_count    bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election public.elections%rowtype;
begin
  select * into v_election from public.elections where is_active limit 1;
  if not found then return; end if;

  if not (public.is_admin() or v_election.results_published) then
    raise exception 'RESULTS_NOT_PUBLISHED';
  end if;

  return query
  -- Candidate tallies
  select p.id, p.title, p.scope, p.grade_level,
         c.id, c.full_name, pa.name, count(v.id)
  from public.positions p
  join public.candidates c on c.position_id = p.id
  left join public.parties pa on pa.id = c.party_id
  left join public.votes    v on v.candidate_id = c.id
  where p.election_id = v_election.id
  group by p.id, p.title, p.scope, p.grade_level, c.id, c.full_name, pa.name, p.display_order, c.display_order

  union all

  -- Abstain bucket per position (counts NULL-candidate votes)
  select p.id, p.title, p.scope, p.grade_level,
         null::uuid, 'Abstain'::text, null::text, count(v.id)
  from public.positions p
  left join public.votes v on v.position_id = p.id and v.candidate_id is null
  where p.election_id = v_election.id
  group by p.id, p.title, p.scope, p.grade_level, p.display_order

  order by 2, 8 desc;
end;
$$;

-- ---------------------------------------------------------------------
-- turnout_stats()  [admin only]
--   Participation by grade and section. No candidate tallies exposed.
-- ---------------------------------------------------------------------
create or replace function public.turnout_stats()
returns table (
  grade_level   int,
  section       text,
  registered    bigint,
  voted         bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  select vo.grade_level, vo.section,
         count(*)                              as registered,
         count(*) filter (where vo.has_voted)  as voted
  from public.voters vo
  group by vo.grade_level, vo.section
  order by vo.grade_level, vo.section;
end;
$$;

-- ---------------------------------------------------------------------
-- publish_results(p_publish)  [admin only]
-- ---------------------------------------------------------------------
create or replace function public.publish_results(p_publish boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;
  update public.elections set results_published = p_publish where is_active;
  return jsonb_build_object('status','ok','published',p_publish);
end;
$$;

-- Execution grants
grant execute on function public.cast_ballot(jsonb)         to authenticated;
grant execute on function public.reset_ballot(text, text)   to authenticated;
grant execute on function public.turnout_stats()            to authenticated;
grant execute on function public.publish_results(boolean)   to authenticated;
grant execute on function public.get_results()              to anon, authenticated;
grant execute on function public.is_admin()                 to anon, authenticated;
