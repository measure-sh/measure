-- migrate:up
create table if not exists measure.http_rules (
    fingerprint text primary key not null,
    team_id uuid references measure.teams(id) on delete cascade,
    app_id uuid references measure.apps(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid not null default '00000000-0000-0000-0000-000000000000' references measure.users(id) on delete set default,
    updated_by uuid not null default '00000000-0000-0000-0000-000000000000' references measure.users(id) on delete set default,
    domain text not null,
    path text not null,
    is_active boolean not null default false
);

comment on column measure.http_rules.fingerprint is 'FNV-1 hash of domain and path, used as unique identifier';
comment on column measure.http_rules.team_id is 'id of team to which the rule belongs';
comment on column measure.http_rules.app_id is 'id of app to which the rule belongs';
comment on column measure.http_rules.created_at is 'utc timestamp when the rule was created';
comment on column measure.http_rules.updated_at is 'utc timestamp when the rule was last updated';
comment on column measure.http_rules.created_by is 'id of user who created the rule';
comment on column measure.http_rules.updated_by is 'id of user who last updated the rule';
comment on column measure.http_rules.domain is 'domain of the http rule';
comment on column measure.http_rules.path is 'path of the http rule';
comment on column measure.http_rules.is_active is 'boolean indicating whether the rule is active or not';

-- index to optimize queries for active rules for a team and app
create index idx_http_team_app_rules_active on measure.http_rules(team_id, app_id) where is_active = true;

-- migrate:down
drop table if exists measure.http_rules;
