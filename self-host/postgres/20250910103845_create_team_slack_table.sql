-- migrate:up
create table if not exists measure.team_slack (
    team_id uuid not null references measure.teams(id) on delete cascade,
    slack_team_id text not null,
    slack_team_name text,
    enterprise_id text,
    enterprise_name text,
    bot_token text not null,
    bot_user_id text not null,
    slack_app_id text,
    scopes text,
    channel_ids text[] default '{}',
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    primary key (team_id),
    unique (slack_team_id)
);

comment on table measure.team_slack is 'tracks Slack integration per team';
comment on column measure.team_slack.team_id is 'internal team UUID';
comment on column measure.team_slack.slack_team_id is 'Slack workspace ID (T01234567890)';
comment on column measure.team_slack.slack_team_name is 'Slack workspace name';
comment on column measure.team_slack.enterprise_id is 'Slack Enterprise Grid ID (E01234567890), null for regular workspaces';
comment on column measure.team_slack.enterprise_name is 'Slack Enterprise Grid name, null for regular workspaces';
comment on column measure.team_slack.bot_token is 'OAuth bot token for the Slack workspace (xoxb-...)';
comment on column measure.team_slack.bot_user_id is 'Slack bot user ID (U01234567890)';
comment on column measure.team_slack.slack_app_id is 'Slack app ID (A01234567890)';
comment on column measure.team_slack.scopes is 'comma-separated list of granted OAuth scopes';
comment on column measure.team_slack.channel_ids is 'Array of Slack channel IDs (C..., G...) where alerts may be sent';
comment on column measure.team_slack.is_active is 'whether the Slack integration is currently active';
comment on column measure.team_slack.created_at is 'timestamp when Slack integration was created';
comment on column measure.team_slack.updated_at is 'timestamp when Slack integration was last updated';

-- migrate:down
drop table if exists measure.team_slack;
