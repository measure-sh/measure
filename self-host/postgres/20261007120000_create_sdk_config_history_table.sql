-- migrate:up
create table if not exists measure.sdk_config_history (
    id uuid primary key not null default gen_random_uuid(),
    app_id uuid not null references measure.apps(id) on delete cascade,
    changed_by uuid references measure.users(id) on delete set null,
    changed_at timestamptz not null,
    changes jsonb not null
);

-- the history endpoint lists one app's changes newest first, a page at a time
create index if not exists sdk_config_history_app_id_changed_at_idx
    on measure.sdk_config_history (app_id, changed_at desc);

comment on table measure.sdk_config_history is 'history of changes made to each app''s SDK config';
comment on column measure.sdk_config_history.id is 'unique id for each change';
comment on column measure.sdk_config_history.app_id is 'linked app id';
comment on column measure.sdk_config_history.changed_by is 'user who made the change';
comment on column measure.sdk_config_history.changed_at is 'utc timestamp of the change, same as the updated_at it set on sdk_config';
comment on column measure.sdk_config_history.changes is 'changed sdk_config columns, keyed by column name, each with its old and new value. A migration that renames or drops a sdk_config column must rename or remove its key here too';

-- migrate:down
drop table if exists measure.sdk_config_history;
