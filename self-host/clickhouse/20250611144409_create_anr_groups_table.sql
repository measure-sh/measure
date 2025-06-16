-- migrate:up
create table if not exists anr_groups
(
    `app_id` UUID not null comment 'linked app id' codec(ZSTD(3)),
    `id` FixedString(32) not null comment 'unique fingerprint of the unhandled exception which acts as the id of the group' codec(ZSTD(3)),
    `type` String not null comment 'type of the ANR' codec(ZSTD(3)),
    `message` String not null comment 'message of the ANR' codec(ZSTD(3)),
    `method_name` String not null comment 'method name where the ANR occurred' codec(ZSTD(3)),
    `file_name` String not null comment 'file name where the ANR occurred' codec(ZSTD(3)),
    `line_number` Int32 not null comment 'line number where the ANR occurred' codec(ZSTD(3)),
    `updated_at` DateTime64(9, 'UTC') not null comment 'utc timestamp at the time of record updation' codec(DoubleDelta, ZSTD(3))
)
engine = ReplacingMergeTree(updated_at)
partition by toYYYYMM(updated_at)
order by (app_id, id)
settings index_granularity = 8192
comment 'aggregated ANR groups';

-- migrate:down
drop table if exists anr_groups;
