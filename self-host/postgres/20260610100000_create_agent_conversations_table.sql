-- migrate:up
create table if not exists measure.agent_conversations (
    id uuid primary key not null,
    user_id uuid not null references measure.users(id) on delete cascade,
    app_id uuid not null references measure.apps(id) on delete cascade,
    team_id uuid not null references measure.teams(id) on delete cascade,
    title text,
    surface text not null default 'mcp',
    slack_channel_id text,
    slack_thread_ts text,
    slack_user_id text,
    slack_context_through_ts text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table measure.agent_conversations is 'table storing query agent conversations, one row per ask_question thread';
comment on column measure.agent_conversations.id is 'unique id for each conversation';
comment on column measure.agent_conversations.user_id is 'id of the user who owns this conversation; for slack conversations this is the measure user resolved from the slack profile email';
comment on column measure.agent_conversations.app_id is 'id of the app this conversation is scoped to';
comment on column measure.agent_conversations.team_id is 'id of the team owning the app at creation time, used for usage metering';
comment on column measure.agent_conversations.title is 'short title derived from the first question';
comment on column measure.agent_conversations.surface is 'where the conversation happens: mcp, slack_mention or slack_assistant';
comment on column measure.agent_conversations.slack_channel_id is 'slack channel holding the conversation thread, set on slack surfaces only';
comment on column measure.agent_conversations.slack_thread_ts is 'timestamp of the slack thread root message, set on slack surfaces only';
comment on column measure.agent_conversations.slack_user_id is 'slack user id of the person who started the conversation, set on slack surfaces only';
comment on column measure.agent_conversations.slack_context_through_ts is 'high-water mark for thread context: timestamp of the most recent slack message already summarized into this conversation, so a later mention only summarizes messages after it; empty means none taken in yet and the last N are used instead; set on slack surfaces only';
comment on column measure.agent_conversations.created_at is 'utc timestamp at the time of conversation creation';
comment on column measure.agent_conversations.updated_at is 'utc timestamp at the time of conversation update';

create index on measure.agent_conversations(user_id, updated_at desc);

-- one conversation per slack thread; follow-ups in a thread continue it
create unique index on measure.agent_conversations(slack_channel_id, slack_thread_ts) where slack_channel_id is not null;

-- migrate:down
drop table if exists measure.agent_conversations;
