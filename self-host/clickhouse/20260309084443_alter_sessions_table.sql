-- migrate:up
alter table sessions
    drop index if exists user_id_bloom_idx,
    drop index if exists team_id_idx,
    drop index if exists crash_count_minmax_idx,
    drop index if exists anr_count_minmax_idx,
    drop column if exists start_time,
    drop column if exists end_time,
    drop column if exists user_id;

-- migrate:down
alter table sessions
    add column if not exists user_id LowCardinality(String) comment 'attributed user id' CODEC(ZSTD(3)),
    add column if not exists start_time SimpleAggregateFunction(min, DateTime64(9, 'UTC')) CODEC(DoubleDelta, ZSTD(3)) after last_event_timestamp,
    add column if not exists end_time SimpleAggregateFunction(max, DateTime64(9, 'UTC')) CODEC(DoubleDelta, ZSTD(3)) after start_time,
    add index if not exists team_id_idx `team_id` type bloom_filter(0.025) granularity 8,
    add index if not exists user_id_bloom_idx `user_id` type bloom_filter granularity 2,
    add index if not exists crash_count_minmax_idx crash_count type minmax granularity 1,
    add index if not exists anr_count_minmax_idx anr_count type minmax granularity 1;

-- migrate:up
alter table sessions
    drop column if exists `event_count`,
    drop column if exists `crash_count`,
    drop column if exists `anr_count`
settings mutations_sync = 2;

-- migrate:down
alter table sessions
    add column if not exists `event_count` SimpleAggregateFunction(sum, UInt64),
    add column if not exists `crash_count` SimpleAggregateFunction(sum, UInt64),
    add column if not exists `anr_count`   SimpleAggregateFunction(sum, UInt64);

-- migrate:up
alter table sessions
    add column if not exists `country_codes`               SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique country codes',
    add column if not exists `network_providers`           SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network service providers',
    add column if not exists `network_types`               SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network types',
    add column if not exists `network_generations`         SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network generations',
    add column if not exists `device_locales`              SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique device locales',
    add column if not exists `device_manufacturer`         String comment 'manufacturer of the device' CODEC(ZSTD(3)),
    add column if not exists `device_name`                 String comment 'name of the device' CODEC(ZSTD(3)),
    add column if not exists `device_model`                String comment 'model of the device' CODEC(ZSTD(3)),
    add column if not exists `user_ids`                    SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all user ids',
    add column if not exists `unique_custom_type_names`    SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique custom event type names' CODEC(ZSTD(3)),
    add column if not exists `unique_strings`              SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique log string values' CODEC(ZSTD(3)),
    add column if not exists `unique_view_classnames`      SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique view class names' CODEC(ZSTD(3)),
    add column if not exists `unique_subview_classnames`   SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique subview class names' CODEC(ZSTD(3)),
    add column if not exists `unique_unhandled_exceptions` SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(type String, message String, file_name String, class_name String, method_name String))) comment 'list of unique tuples of unhandled exception details' CODEC(ZSTD(3)),
    add column if not exists `unique_handled_exceptions`   SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(type String, message String, file_name String, class_name String, method_name String))) comment 'list of unique tuples of handled exception details' CODEC(ZSTD(3)),
    add column if not exists `unique_errors`               SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique exception error values' CODEC(ZSTD(3)),
    add column if not exists `unique_anrs`                 SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(type String, message String, file_name String, class_name String, method_name String))) comment 'list of unique tuples of anr details' CODEC(ZSTD(3)),
    add column if not exists `unique_click_targets`        SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of click targets and ids' CODEC(ZSTD(3)),
    add column if not exists `unique_longclick_targets`    SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of long click targets and ids' CODEC(ZSTD(3)),
    add column if not exists `unique_scroll_targets`       SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of scroll targets and ids' CODEC(ZSTD(3)),
    add column if not exists `event_count` SimpleAggregateFunction(sum, UInt64) CODEC(ZSTD(3)) after `unique_scroll_targets`,
    add column if not exists `crash_count` SimpleAggregateFunction(sum, UInt64) CODEC(ZSTD(3)) after `event_count`,
    add column if not exists `anr_count`   SimpleAggregateFunction(sum, UInt64) CODEC(ZSTD(3)) after `crash_count`,
    add column if not exists `bug_report_count`            SimpleAggregateFunction(sum, UInt64) comment 'count of bug report events in this session' CODEC(ZSTD(3)),
    add column if not exists `background_count`            SimpleAggregateFunction(sum, UInt64) comment 'count of background events in this session' CODEC(ZSTD(3)),
    add column if not exists `foreground_count`            SimpleAggregateFunction(sum, UInt64) comment 'count of foreground events in this session' CODEC(ZSTD(3)),
    add column if not exists `event_type_counts`           SimpleAggregateFunction(sumMap, Map(String, UInt64)) comment 'count of event types in this session' CODEC(ZSTD(3));


-- migrate:down
alter table sessions
    drop column if exists `country_codes`,
    drop column if exists `network_providers`,
    drop column if exists `network_types`,
    drop column if exists `network_generations`,
    drop column if exists `device_locales`,
    drop column if exists `device_manufacturer`,
    drop column if exists `device_name`,
    drop column if exists `device_model`,
    drop column if exists `user_ids`,
    drop column if exists `unique_custom_type_names`,
    drop column if exists `unique_strings`,
    drop column if exists `unique_view_classnames`,
    drop column if exists `unique_subview_classnames`,
    drop column if exists `unique_unhandled_exceptions`,
    drop column if exists `unique_handled_exceptions`,
    drop column if exists `unique_errors`,
    drop column if exists `unique_anrs`,
    drop column if exists `unique_click_targets`,
    drop column if exists `unique_longclick_targets`,
    drop column if exists `unique_scroll_targets`,
    drop column if exists `event_count`,
    drop column if exists `crash_count`,
    drop column if exists `anr_count`,
    drop column if exists `bug_report_count`,
    drop column if exists `background_count`,
    drop column if exists `foreground_count`,
    drop column if exists `event_type_counts`
settings mutations_sync = 2;

-- migrate:up
alter table sessions
    add index if not exists crash_count_minmax_idx crash_count type minmax granularity 1,
    add index if not exists anr_count_minmax_idx anr_count type minmax granularity 1
settings mutations_sync = 2;

-- migrate:down
alter table sessions
    drop index if exists crash_count_minmax_idx,
    drop index if exists anr_count_minmax_idx
settings mutations_sync = 2;
