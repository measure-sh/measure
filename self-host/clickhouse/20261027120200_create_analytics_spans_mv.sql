-- migrate:up
create materialized view if not exists analytics_spans_mv
to analytics_events
as select
  -- A span has no event id. The id comes from the trace id and the span id.
  -- Thus the table removes a span that ingest inserts two times.
  reinterpretAsUUID(concat(
    reinterpretAsFixedString(cityHash64(trace_id, span_id)),
    reinterpretAsFixedString(cityHash64(span_id, trace_id)))) as id,
  team_id,
  app_id,
  attribute.installation_id as installation_id,
  session_id,
  start_time as timestamp,
  inserted_at,
  'span' as type,
  span_name as `span.name`,
  trace_id as `span.trace_id`,
  status as `span.status`,
  toUInt32(greatest(dateDiff('millisecond', start_time, end_time), 0)) as `span.duration_ms`,
  attribute.app_version.1 as `attribute.app_version`,
  attribute.app_version.2 as `attribute.app_build`,
  attribute.patch_version,
  attribute.patch_id,
  attribute.os_version.1 as `attribute.os_name`,
  attribute.os_version.2 as `attribute.os_version`,
  attribute.device_name,
  attribute.device_manufacturer,
  attribute.device_locale,
  attribute.network_type,
  attribute.network_generation,
  attribute.network_provider,
  attribute.user_id,
  attribute.country_code as `inet.country_code`,
  user_defined_attribute
from spans
where parent_id = ''
;

-- migrate:down
drop view if exists analytics_spans_mv;
