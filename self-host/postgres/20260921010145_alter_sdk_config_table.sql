-- migrate:up
alter table measure.sdk_config
  add column if not exists memory_usage_session_sampling_rate float8 not null default 100,
  add column if not exists memory_usage_background_interval int not null default 10;

comment on column measure.sdk_config.memory_usage_session_sampling_rate is 'sampling rate for memory usage sessions';
comment on column measure.sdk_config.memory_usage_background_interval is 'memory usage measurement interval while the app is in the background';

-- migrate:down
alter table measure.sdk_config
  drop column if exists memory_usage_session_sampling_rate,
  drop column if exists memory_usage_background_interval;
