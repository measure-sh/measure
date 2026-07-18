-- migrate:up
-- collapse duplicate memberships if any before the unique index below, keeping the
-- earliest row per (team_id, user_id) with the id as tie-break
delete from measure.team_membership tm
using measure.team_membership dup
where tm.team_id = dup.team_id
  and tm.user_id = dup.user_id
  and (tm.created_at > dup.created_at
       or (tm.created_at = dup.created_at and tm.id > dup.id));

-- a user is a member of a team at most once
create unique index if not exists team_membership_team_id_user_id_idx on measure.team_membership (team_id, user_id);

-- migrate:down
drop index if exists measure.team_membership_team_id_user_id_idx;
