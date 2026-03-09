-- migrate:up
create table if not exists sessions
(
    `session_id`                    UUID comment 'session id' CODEC(LZ4),
    `team_id`                       LowCardinality(UUID) CODEC(LZ4),
    `app_id`                        LowCardinality(UUID) comment 'unique id of the app' CODEC(LZ4),
    `first_event_timestamp`         SimpleAggregateFunction(min, DateTime64(3, 'UTC')) comment 'timestamp of the first event' CODEC(DoubleDelta, ZSTD(3)),
    `last_event_timestamp`          SimpleAggregateFunction(max, DateTime64(3, 'UTC')) comment 'timestamp of the last event' CODEC(DoubleDelta, ZSTD(3)),
    `app_version`                   Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
    `os_version`                    Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
    `country_codes`                 SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique country codes',
    `network_providers`             SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network service providers',
    `network_types`                 SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network types',
    `network_generations`           SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network generations',
    `device_locales`                SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique device locales',
    `device_manufacturer`           String comment 'manufacturer of the device' CODEC(ZSTD(3)),
    `device_name`                   String comment 'name of the device' CODEC(ZSTD(3)),
    `device_model`                  String comment 'model of the device' CODEC(ZSTD(3)),
    `user_id`                       LowCardinality(String) comment 'attributed user id (compatibility column)' CODEC(ZSTD(3)),
    `user_ids`                      SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all user ids',
    `unique_types`                  SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique event type' CODEC(ZSTD(3)),
    `unique_custom_type_names`      SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique custom event type names' CODEC(ZSTD(3)),
    `unique_strings`                SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique log string values' CODEC(ZSTD(3)),
    `unique_view_classnames`        SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique view class names' CODEC(ZSTD(3)),
    `unique_subview_classnames`     SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique subview class names' CODEC(ZSTD(3)),
    `unique_unhandled_exceptions`   SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(type String, message String, file_name String, class_name String, method_name String))) comment 'list of unique tuples of unhandled exception details' CODEC(ZSTD(3)),
    `unique_handled_exceptions`     SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(type String, message String, file_name String, class_name String, method_name String))) comment 'list of unique tuples of handled exception details' CODEC(ZSTD(3)),
    `unique_errors`                 SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique exception error values' CODEC(ZSTD(3)),
    `unique_anrs`                   SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(type String, message String, file_name String, class_name String, method_name String))) comment 'list of unique tuples of anr details' CODEC(ZSTD(3)),
    `unique_click_targets`          SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of click targets and ids' CODEC(ZSTD(3)),
    `unique_longclick_targets`      SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of long click targets and ids' CODEC(ZSTD(3)),
    `unique_scroll_targets`         SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of scroll targets and ids' CODEC(ZSTD(3)),
    `event_count`                   SimpleAggregateFunction(sum, UInt64) comment 'count of events in this session' CODEC(ZSTD(3)),
    `crash_count`                   SimpleAggregateFunction(sum, UInt64) comment 'count of crash events in this session' CODEC(ZSTD(3)),
    `anr_count`                     SimpleAggregateFunction(sum, UInt64) comment 'count of ANR events in this session' CODEC(ZSTD(3)),
    `bug_report_count`              SimpleAggregateFunction(sum, UInt64) comment 'count of bug report events in this session' CODEC(ZSTD(3)),
    `background_count`              SimpleAggregateFunction(sum, UInt64) comment 'count of background events in this session' CODEC(ZSTD(3)),
    `foreground_count`              SimpleAggregateFunction(sum, UInt64) comment 'count of foreground events in this session' CODEC(ZSTD(3)),
    `event_type_counts`             SimpleAggregateFunction(sumMap, Map(String, UInt64)) comment 'count of event types in this session' CODEC(ZSTD(3)),
    index session_id_bloom_idx session_id type bloom_filter(0.01) granularity 1,
    index crash_count_minmax_idx crash_count type minmax granularity 1,
    index anr_count_minmax_idx anr_count type minmax granularity 1,
    index bug_report_count_minmax_idx bug_report_count type minmax granularity 1,
    index background_count_minmax_idx background_count type minmax granularity 1,
    index foreground_count_minmax_idx foreground_count type minmax granularity 1,
    index event_type_counts_bloom_idx mapKeys(event_type_counts) type bloom_filter(0.025) granularity 1,
    index first_event_timestamp_minmax_idx first_event_timestamp type minmax granularity 1,
    index last_event_timestamp_minmax_idx last_event_timestamp type minmax granularity 1
)
engine = AggregatingMergeTree
partition by toYYYYMM(first_event_timestamp)
order by (team_id, app_id, app_version.1, app_version.2, session_id)
settings index_granularity = 8192
comment 'aggregated app sessions';

-- migrate:down
drop table if exists sessions;
