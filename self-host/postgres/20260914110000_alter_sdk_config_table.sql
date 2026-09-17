-- migrate:up
alter table measure.sdk_config
  add column if not exists memory_usage_session_sampling_rate float8 not null default 100;

comment on column measure.sdk_config.memory_usage_session_sampling_rate is 'percentage of Android sessions that track memory usage (0-100)';

-- migrate:down
alter table measure.sdk_config
  drop column if exists memory_usage_session_sampling_rate;
