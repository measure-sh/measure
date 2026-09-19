-- migrate:up
alter table measure.sdk_config
  add column if not exists memory_usage_session_sampling_rate float8 not null default 100;

comment on column measure.sdk_config.memory_usage_session_sampling_rate is 'sampling rate for memory usage sessions';

-- migrate:down
alter table measure.sdk_config
  drop column if exists memory_usage_session_sampling_rate;
