-- migrate:up
create table if not exists journey
(
  `id` UUID comment 'unique event id' CODEC(LZ4),
  `team_id` UUID comment 'associated team id' CODEC(LZ4),
  `app_id` UUID comment 'associated app id' CODEC(LZ4),
  `session_id` UUID comment 'associated session id' CODEC(LZ4),
  `timestamp` DateTime64(3, 'UTC') comment 'event timestamp' CODEC(DoubleDelta, ZSTD(3)),
  `inserted_at` DateTime64(3, 'UTC') comment 'original event insertion timestamp' CODEC(Delta(8), ZSTD(3)),
  `type` LowCardinality(String) COMMENT 'type of the event' CODEC(ZSTD(3)),
  `app_version` Tuple(LowCardinality(String), LowCardinality(String)) COMMENT 'app version identifier' CODEC(ZSTD(3)),
  `exception.handled` Bool COMMENT 'exception was handled by application code' CODEC(ZSTD(3)),
  `lifecycle_activity.type` LowCardinality(String) COMMENT 'type of the lifecycle activity, either - created, resumed, paused, destroyed' CODEC(ZSTD(3)),
  `lifecycle_activity.class_name` String COMMENT 'fully qualified class name of the activity' CODEC(ZSTD(3)),
  `lifecycle_fragment.type` LowCardinality(String) COMMENT 'type of the lifecycle fragment, either - attached, resumed, paused, detached' CODEC(ZSTD(3)),
  `lifecycle_fragment.class_name` String COMMENT 'fully qualified class name of the fragment' CODEC(ZSTD(3)),
  `lifecycle_fragment.parent_activity` String COMMENT 'fully qualified class name of the parent activity that the fragment is attached to' CODEC(ZSTD(3)),
  `lifecycle_fragment.parent_fragment` String COMMENT 'fully qualified class name of the parent fragment that the fragment is attached to' CODEC(ZSTD(3)),
  `lifecycle_view_controller.type` LowCardinality(String) COMMENT 'type of the iOS ViewController lifecycle event',
  `lifecycle_view_controller.class_name` LowCardinality(String) COMMENT 'class name of the iOS ViewController lifecycle event',
  `lifecycle_swift_ui.type` LowCardinality(String) COMMENT 'type of the iOS SwiftUI view lifecycle event',
  `lifecycle_swift_ui.class_name` LowCardinality(String) COMMENT 'class name of the iOS SwiftUI view lifecycle event',
  `screen_view.name` String COMMENT 'name of the screen viewed' CODEC(ZSTD(3))
)
engine = ReplacingMergeTree
partition by toYYYYMM(timestamp)
order by (team_id, app_id, app_version, timestamp, id)
comment 'journey events';

-- migrate:down
drop table if exists journey;
