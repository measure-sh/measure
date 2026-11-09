-- migrate:up
create table if not exists analytics_events
(
  `id` UUID comment 'unique event id, or an id derived from the trace and span ids for a span' CODEC(LZ4),
  `team_id` LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
  `app_id` LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
  `installation_id` UUID comment 'app installation that sent the event' CODEC(LZ4),
  `session_id` UUID comment 'associated session id' CODEC(LZ4),
  `timestamp` DateTime64(3, 'UTC') comment 'event timestamp, or start time for a span' CODEC(DoubleDelta, ZSTD(3)),
  `inserted_at` DateTime64(3, 'UTC') comment 'original event or span insertion timestamp' CODEC(Delta(8), ZSTD(3)),
  `type` LowCardinality(String) comment 'type of the event, or span for a root span' CODEC(ZSTD(3)),
  `screen.name` LowCardinality(String) comment 'screen name of a lifecycle or screen view event' CODEC(ZSTD(3)),
  `custom.name` LowCardinality(String) comment 'name of a custom event' CODEC(ZSTD(3)),
  `error.fingerprint` String comment 'fingerprint of an exception, ANR or app hang' CODEC(ZSTD(3)),
  `error.severity` LowCardinality(String) comment 'either - fatal, nonfatal; selects the group table of an exception, ANR or app hang' CODEC(ZSTD(3)),
  `app_hang.state` LowCardinality(String) comment 'either - recovered, killed' CODEC(ZSTD(3)),
  `http.method` LowCardinality(String) comment 'method of an http request' CODEC(ZSTD(3)),
  `http.domain` LowCardinality(String) comment 'domain of an http request' CODEC(ZSTD(3)),
  `http.path` String comment 'path of an http request' CODEC(ZSTD(3)),
  `http.status_code` UInt16 comment 'status code of an http response' CODEC(ZSTD(3)),
  `http.latency_ms` UInt32 comment 'time from the start to the end of an http request' CODEC(T64, ZSTD(3)),
  `span.name` LowCardinality(String) comment 'name of a root span' CODEC(ZSTD(3)),
  `span.trace_id` FixedString(32) comment 'trace id of a root span' CODEC(ZSTD(3)),
  `span.status` UInt8 comment 'status of a root span' CODEC(ZSTD(3)),
  `span.duration_ms` UInt32 comment 'time from the start to the end of a root span' CODEC(T64, ZSTD(3)),
  `gesture_click.target` String comment 'class or instance name of the originating view' CODEC(ZSTD(3)),
  `gesture_click.target_id` String comment 'unique identifier of the target' CODEC(ZSTD(3)),
  `gesture_click.label` String comment 'visible text of the clicked element' CODEC(ZSTD(3)),
  `gesture_click.semantic_label` String comment 'accessibility label of the clicked element' CODEC(ZSTD(3)),
  `gesture_long_click.target` String comment 'class or instance name of the originating view' CODEC(ZSTD(3)),
  `gesture_long_click.target_id` String comment 'unique identifier of the target' CODEC(ZSTD(3)),
  `gesture_long_click.label` String comment 'visible text of the clicked element' CODEC(ZSTD(3)),
  `gesture_long_click.semantic_label` String comment 'accessibility label of the clicked element' CODEC(ZSTD(3)),
  `gesture_scroll.target` String comment 'class or instance name of the originating view' CODEC(ZSTD(3)),
  `gesture_scroll.target_id` String comment 'unique identifier of the target' CODEC(ZSTD(3)),
  `gesture_scroll.direction` LowCardinality(String) comment 'direction of the scroll' CODEC(ZSTD(3)),
  `lifecycle_app.type` LowCardinality(String) comment 'type of the lifecycle app, either - background, foreground, terminated' CODEC(ZSTD(3)),
  `cold_launch.launched_activity` String comment 'activity which drew the first frame during cold launch' CODEC(ZSTD(3)),
  `cold_launch.intent_data` String comment 'intent data used to launch the launched_activity' CODEC(ZSTD(3)),
  `cold_launch.duration` UInt32 comment 'computed cold launch duration' CODEC(T64, ZSTD(3)),
  `warm_launch.launched_activity` String comment 'activity which drew the first frame during warm launch' CODEC(ZSTD(3)),
  `warm_launch.intent_data` String comment 'intent data used to launch the launched_activity' CODEC(ZSTD(3)),
  `warm_launch.duration` UInt32 comment 'computed warm launch duration' CODEC(T64, ZSTD(3)),
  `hot_launch.launched_activity` String comment 'activity which drew the first frame during hot launch' CODEC(ZSTD(3)),
  `hot_launch.intent_data` String comment 'intent data used to launch the launched_activity' CODEC(ZSTD(3)),
  `hot_launch.duration` UInt32 comment 'computed hot launch duration' CODEC(T64, ZSTD(3)),
  `attribute.app_version` LowCardinality(String) comment 'app version name' CODEC(ZSTD(3)),
  `attribute.app_build` LowCardinality(String) comment 'app version build' CODEC(ZSTD(3)),
  `attribute.patch_version` LowCardinality(String) comment 'OTA patch version' CODEC(ZSTD(3)),
  `attribute.patch_id` UUID comment 'OTA patch id' CODEC(ZSTD(3)),
  `attribute.os_name` LowCardinality(String) comment 'name of the operating system' CODEC(ZSTD(3)),
  `attribute.os_version` LowCardinality(String) comment 'version of the operating system' CODEC(ZSTD(3)),
  `attribute.device_name` LowCardinality(String) comment 'name of the device' CODEC(ZSTD(3)),
  `attribute.device_manufacturer` LowCardinality(String) comment 'manufacturer of the device' CODEC(ZSTD(3)),
  `attribute.device_locale` LowCardinality(String) comment 'locale of the device' CODEC(ZSTD(3)),
  `attribute.network_type` LowCardinality(String) comment 'either - wifi, cellular, vpn, unknown, no_network' CODEC(ZSTD(3)),
  `attribute.network_generation` LowCardinality(String) comment 'either - 2g, 3g, 4g, 5g, unknown' CODEC(ZSTD(3)),
  `attribute.network_provider` LowCardinality(String) comment 'name of the network service provider' CODEC(ZSTD(3)),
  `attribute.user_id` String comment 'attributed user id' CODEC(ZSTD(3)),
  `inet.country_code` LowCardinality(String) comment 'country code' CODEC(ZSTD(3)),
  `user_defined_attribute` Map(LowCardinality(String), Tuple(Enum('string' = 1, 'int64', 'float64', 'bool'), String)) comment 'user defined attributes of the event or span' CODEC(ZSTD(3)),
  index custom_name_bloom_idx `custom.name` type bloom_filter granularity 2,
  index error_fingerprint_bloom_idx `error.fingerprint` type bloom_filter(0.025) granularity 4,
  index span_name_bloom_idx `span.name` type bloom_filter granularity 2,
  index user_id_bloom_idx `attribute.user_id` type bloom_filter(0.01) granularity 2,
  index user_defined_attribute_key_bloom_idx mapKeys(user_defined_attribute) type bloom_filter(0.01) granularity 8
)
engine = ReplacingMergeTree
partition by toYYYYMM(timestamp)
-- The installation hash comes after the type. Thus a sample by installation
-- reads only a part of the rows of each type.
order by (team_id, app_id, toDate(timestamp), type, cityHash64(installation_id), session_id, timestamp, id)
sample by cityHash64(installation_id)
settings index_granularity = 8192
comment 'events and root spans for journeys, funnels and other analytics';

-- migrate:down
drop table if exists analytics_events;
