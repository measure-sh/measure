-- migrate:up
alter table measure.agent_conversations drop column if exists app_id;

-- cleanup deletes stale conversations per team
create index if not exists agent_conversations_team_id_updated_at_idx on measure.agent_conversations (team_id, updated_at);

-- migrate:down
-- Rolling back deletes every conversation: the drop above discarded all
-- app_id values, so after the re-add every row is null and unreadable by the
-- pre-drop code, which requires app_id on each row.
drop index if exists measure.agent_conversations_team_id_updated_at_idx;
alter table measure.agent_conversations add column if not exists app_id uuid references measure.apps(id) on delete cascade;
delete from measure.agent_conversations where app_id is null;
alter table measure.agent_conversations alter column app_id set not null;
