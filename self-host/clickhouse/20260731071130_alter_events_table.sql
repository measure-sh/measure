-- migrate:up
alter table events
    add column if not exists `anr.thread_dump` String comment 'system thread dump captured at anr kill' CODEC(ZSTD(3)) after `anr.foreground`,
    add column if not exists `anr.subject` String comment 'one-line anr cause reported by the system' CODEC(ZSTD(3)) after `anr.thread_dump`
settings mutations_sync = 2;

-- migrate:down
alter table events
    drop column if exists `anr.thread_dump`,
    drop column if exists `anr.subject`
settings mutations_sync = 2;
