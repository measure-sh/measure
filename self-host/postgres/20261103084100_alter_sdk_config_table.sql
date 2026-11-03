-- migrate:up
alter table measure.sdk_config
  add column if not exists analytics_sampling_rate float8 not null default 100;

-- Backfill the analytics rate from the journey rate. Analytics sampling replaces
-- journey sampling, so existing apps keep sampling journeys at the same rate.
update measure.sdk_config
set analytics_sampling_rate = journey_sampling_rate;

comment on column measure.sdk_config.analytics_sampling_rate is 'sampling rate for installations that send analytics events';

-- migrate:down
alter table measure.sdk_config
  drop column if exists analytics_sampling_rate;
