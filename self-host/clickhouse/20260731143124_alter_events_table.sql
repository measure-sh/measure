-- migrate:up
alter table events
    add column if not exists `anr.art_thread_dump` String comment 'art thread dump from app exit info' CODEC(ZSTD(3)) after `anr.foreground`,
    add column if not exists `anr.subject` String comment 'subject extracted from the app exit info art thread dump' CODEC(ZSTD(3)) after `anr.art_thread_dump`
settings mutations_sync = 2;

-- migrate:down
alter table events
    drop column if exists `anr.art_thread_dump`,
    drop column if exists `anr.subject`
settings mutations_sync = 2;
