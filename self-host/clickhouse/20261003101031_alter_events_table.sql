-- migrate:up
alter table events
    add column if not exists `anr.subject` String comment 'system reported cause of the anr' CODEC(ZSTD(3)) after `anr.foreground`,
    add column if not exists `anr.thread_dump` String comment 'threads, frames and locks parsed from the art thread dump' CODEC(ZSTD(3)) after `anr.subject`
settings mutations_sync = 2;

-- migrate:down
alter table events
    drop column if exists `anr.subject`,
    drop column if exists `anr.thread_dump`
settings mutations_sync = 2;
