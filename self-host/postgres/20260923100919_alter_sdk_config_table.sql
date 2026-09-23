-- migrate:up
alter table measure.sdk_config
  alter column memory_usage_session_sampling_rate set default 0.01;

update measure.sdk_config
set memory_usage_session_sampling_rate = 0.01
where memory_usage_session_sampling_rate = 100;

-- migrate:down
alter table measure.sdk_config
  alter column memory_usage_session_sampling_rate set default 100;
