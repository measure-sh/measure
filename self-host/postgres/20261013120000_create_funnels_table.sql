-- migrate:up
create table if not exists measure.funnels (
    id uuid primary key not null default gen_random_uuid(),
    app_id uuid not null references measure.apps(id) on delete cascade,
    name text not null,
    steps text[] not null,
    conversion_window_seconds integer not null,
    pin_order integer,
    created_by uuid references measure.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint funnels_name_length check (char_length(name) between 1 and 256),
    constraint funnels_steps_count check (cardinality(steps) between 2 and 30),
    constraint funnels_conversion_window_bounds
        check (conversion_window_seconds between 60 and 2592000 and conversion_window_seconds % 60 = 0),
    -- Postgres checks a unique constraint as each row changes, so swapping two
    -- pinned funnels would fail at the first update, when both rows briefly
    -- hold the same pin_order. Checking at commit allows the swap and still
    -- rejects two funnels pinned at the same position.
    constraint funnels_app_id_pin_order_key unique (app_id, pin_order) deferrable initially deferred
);

comment on table measure.funnels is 'funnels defined for each app';
comment on column measure.funnels.id is 'unique id for each funnel';
comment on column measure.funnels.app_id is 'linked app id';
comment on column measure.funnels.name is 'name of the funnel';
comment on column measure.funnels.steps is 'custom event names of the funnel''s steps, in step order';
comment on column measure.funnels.conversion_window_seconds is 'seconds from the first step within which a user must send every later step to convert, always a whole number of minutes';
comment on column measure.funnels.pin_order is 'sorts the app''s pinned funnels, lowest first, or null when the funnel is not pinned';
comment on column measure.funnels.created_by is 'user who created the funnel';
comment on column measure.funnels.created_at is 'utc timestamp at the time of funnel creation';
comment on column measure.funnels.updated_at is 'utc timestamp at the time of funnel update';

-- the funnels list shows one app's funnels, most recently updated first
create index if not exists funnels_app_id_updated_at_idx
    on measure.funnels (app_id, updated_at desc);

-- migrate:down
drop table if exists measure.funnels;
