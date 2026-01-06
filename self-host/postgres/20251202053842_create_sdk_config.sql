-- migrate:up
create table if not exists measure.sdk_config (
    team_id uuid not null references measure.teams(id) on delete cascade,
    app_id uuid not null references measure.apps(id) on delete cascade,
    max_events_in_batch int not null,
    crash_timeline_duration int not null,
    anr_timeline_duration int not null,
    bug_report_timeline_duration int not null,
    trace_sampling_rate float8 not null,
    journey_sampling_rate float8 not null,
    screenshot_mask_level text not null,
    cpu_usage_interval int not null,
    memory_usage_interval int not null,
    crash_take_screenshot boolean not null,
    anr_take_screenshot boolean not null,
    launch_sampling_rate float8 not null,
    gesture_click_take_snapshot boolean not null,
    http_disable_event_for_urls text [] not null,
    http_track_request_for_urls text [] not null,
    http_track_response_for_urls text [] not null,
    http_blocked_headers text [] not null,
    updated_at timestamptz,
    updated_by uuid,
    primary key (app_id)
);

comment on table measure.sdk_config is 'SDK configuration for each app';
comment on column measure.sdk_config.team_id is 'linked team id';
comment on column measure.sdk_config.app_id is 'linked app id';
comment on column measure.sdk_config.max_events_in_batch is 'maximum number of events in a batch';
comment on column measure.sdk_config.crash_timeline_duration is 'duration for timeline collected with crashes';
comment on column measure.sdk_config.anr_timeline_duration is 'duration for timeline collected with ANRs';
comment on column measure.sdk_config.bug_report_timeline_duration is 'duration for timeline collected with bug reports';
comment on column measure.sdk_config.trace_sampling_rate is 'sampling rate for traces';
comment on column measure.sdk_config.journey_sampling_rate is 'sampling rate for journeys';
comment on column measure.sdk_config.screenshot_mask_level is 'screenshot masking level';
comment on column measure.sdk_config.cpu_usage_interval is 'CPU usage measurement interval';
comment on column measure.sdk_config.memory_usage_interval is 'memory usage measurement interval';
comment on column measure.sdk_config.crash_take_screenshot is 'whether to take screenshot on crash';
comment on column measure.sdk_config.anr_take_screenshot is 'whether to take screenshot on ANR';
comment on column measure.sdk_config.launch_sampling_rate is 'sampling rate for launch events';
comment on column measure.sdk_config.gesture_click_take_snapshot is 'whether to take snapshot on gesture click';
comment on column measure.sdk_config.http_disable_event_for_urls is 'URLs to disable HTTP event tracking';
comment on column measure.sdk_config.http_track_request_for_urls is 'URLs to capture full HTTP request (body and headers)';
comment on column measure.sdk_config.http_track_response_for_urls is 'URLs to capture full HTTP response (body and headers)';
comment on column measure.sdk_config.http_blocked_headers is 'HTTP header names to never capture (applies globally)';
comment on column measure.sdk_config.updated_at is 'utc timestamp at the time of last update';
comment on column measure.sdk_config.updated_by is 'user who last updated the config';

-- migrate:down
drop table if exists measure.sdk_config;