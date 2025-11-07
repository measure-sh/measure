-- migrate:up
create table if not exists measure.event_targeting_rules (
    id uuid primary key not null,
    team_id uuid not null,
    app_id uuid not null,
    sampling_rate numeric(9, 6) not null,
    condition text not null,
    collection_mode text not null,
    take_screenshot boolean not null default false,
    take_layout_snapshot boolean not null default false,
    created_at timestamptz not null default now(),
    created_by uuid not null,
    updated_at timestamptz not null default now(),
    updated_by uuid not null
);

comment on table measure.event_targeting_rules is 'table storing event targeting rules';
comment on column measure.event_targeting_rules.team_id is 'id of team to which the rule belongs';
comment on column measure.event_targeting_rules.app_id is 'app_id of the app to which the rule belongs';
comment on column measure.event_targeting_rules.id is 'id of the rule';
comment on column measure.event_targeting_rules.sampling_rate is 'the percentage sampling rate applied';
comment on column measure.event_targeting_rules.condition is 'the condition represented as a CEL expression';
comment on column measure.event_targeting_rules.collection_mode is 'the collection mode for the event (e.g., "sampled", "session_timeline", "none")';
comment on column measure.event_targeting_rules.take_screenshot is 'whether to take a screenshot for the event';
comment on column measure.event_targeting_rules.take_layout_snapshot is 'whether to take a layout snapshot for the event';
comment on column measure.event_targeting_rules.created_at is 'utc timestamp at the time of rule creation';
comment on column measure.event_targeting_rules.created_by is ' id of the user who created the rule';
comment on column measure.event_targeting_rules.updated_at is 'utc timestamp at the time of rule update';
comment on column measure.event_targeting_rules.updated_by is 'id of the user who updated the rule';

-- migrate:down
drop table if exists measure.event_targeting_rules;