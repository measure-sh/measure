-- migrate:up
create table if not exists sessions
(
    `app_id`                        UUID not null comment 'unique id of th app' codec(ZSTD(3)),
    `session_id`                    UUID not null comment 'session id' codec(ZSTD(3)),
    `first_event_timestamp`         DateTime64(9, 'UTC') not null comment 'timestamp of the first event' codec(DoubleDelta, ZSTD(3)),
    `last_event_timestamp`          DateTime64(9, 'UTC') not null comment 'timestamp of the last event' codec(DoubleDelta, ZSTD(3)),
    `app_version`                   Tuple(LowCardinality(String), LowCardinality(String)) not null comment 'composite app version' codec(ZSTD(3)),
    `os_version`                    Tuple(LowCardinality(String), LowCardinality(String)) not null comment 'composite os version' codec(ZSTD(3)),
    `country_code`                  LowCardinality(String) comment 'country code' codec(ZSTD(3)),
    `network_provider`              LowCardinality(String) comment 'name of the network service provider' codec(ZSTD(3)),
    `network_type`                  LowCardinality(String) comment 'wifi, cellular, vpn and so on' codec(ZSTD(3)),
    `network_generation`            LowCardinality(String) comment '2g, 3g, 4g and so on' codec(ZSTD(3)),
    `device_locale`                 LowCardinality(String) comment 'rfc 5646 locale string' codec(ZSTD(3)),
    `device_manufacturer`           LowCardinality(String) comment 'manufacturer of the device' codec(ZSTD(3)),
    `device_name`                   LowCardinality(String) comment 'name of the device' codec(ZSTD(3)),
    `device_model`                  LowCardinality(String) comment 'model of the device' codec(ZSTD(3)),
    `user_id`                       LowCardinality(String) comment 'attributed user id' codec(ZSTD(3)),
    `unique_types`                  SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique event type' codec(ZSTD(3)),
    `unique_strings`                SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique log string values' codec(ZSTD(3)),
    `unique_view_classnames`        SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique view class names' codec(ZSTD(3)),
    `unique_subview_classnames`     SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique subview class names' codec(ZSTD(3)),
    `unique_exceptions`             SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(type String, message String, file_name String, class_name String, method_name String))) comment 'list of unique tuples of exception type and message' codec(ZSTD(3)),
    `unique_anrs`                   SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(type String, message String, file_name String, class_name String, method_name String))) comment 'list of unique tuples of anr type and message' codec(ZSTD(3)),
    `unique_click_targets`          SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of click targets and ids' codec(ZSTD(3)),
    `unique_longclick_targets`      SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of long click targets and ids' codec(ZSTD(3)),
    `unique_scroll_targets`         SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of scroll targets and ids' codec(ZSTD(3)),
    `event_count`                   AggregateFunction(uniq, UUID) not null comment 'unique count of events in this session' codec(ZSTD(3)),
    `crash_count`                   AggregateFunction(uniq, UUID) not null comment 'unique count of crash events in this session' codec(ZSTD(3)),
    `anr_count`                     AggregateFunction(uniq, UUID) not null comment 'unique count of ANR events in this session' codec(ZSTD(3))
)
engine = AggregatingMergeTree
partition by toYYYYMM(first_event_timestamp)
order by (app_id, session_id, first_event_timestamp, app_version, os_version)
settings index_granularity = 8192
comment 'aggregated app sessions';


-- migrate:down
drop table if exists sessions;
