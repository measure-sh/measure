-- migrate:up
alter table measure.sdk_config
  drop column if exists max_events_in_batch,
  drop column if exists cpu_usage_interval,
  drop column if exists gesture_click_take_snapshot;

-- migrate:down
alter table measure.sdk_config
  add column if not exists max_events_in_batch int not null default 10000,
  add column if not exists cpu_usage_interval int not null default 5,
  add column if not exists gesture_click_take_snapshot boolean not null default true;

comment on column measure.sdk_config.max_events_in_batch is 'maximum number of events in a batch';
comment on column measure.sdk_config.cpu_usage_interval is 'CPU usage measurement interval';
comment on column measure.sdk_config.gesture_click_take_snapshot is 'whether to take snapshot on gesture click';
