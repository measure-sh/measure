-- migrate:up
alter table measure.sdk_config
  add column if not exists app_hang_threshold_millis int not null default 2000,
  add column if not exists app_hang_timeline_duration int not null default 300,
  add column if not exists app_hang_sampling_rate float8 not null default 100,
  add column if not exists app_hang_replay_enabled boolean not null default true;

comment on column measure.sdk_config.app_hang_threshold_millis is 'how long the main thread must be unresponsive before it is reported as an app hang';
comment on column measure.sdk_config.app_hang_timeline_duration is 'duration for timeline collected with app hangs';
comment on column measure.sdk_config.app_hang_sampling_rate is 'sampling rate for app hangs';
comment on column measure.sdk_config.app_hang_replay_enabled is 'whether to collect a session replay with app hangs';

-- migrate:down
alter table measure.sdk_config
  drop column if exists app_hang_threshold_millis,
  drop column if exists app_hang_timeline_duration,
  drop column if exists app_hang_sampling_rate,
  drop column if exists app_hang_replay_enabled;
