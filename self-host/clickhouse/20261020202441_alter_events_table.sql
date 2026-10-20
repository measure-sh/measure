-- migrate:up
alter table events
    add column if not exists `exception.abort_message` String comment 'message passed to abort by native code' CODEC(ZSTD(3)) after `exception.meta`,
    add column if not exists `exception.cause` String comment 'os reported cause of a native crash' CODEC(ZSTD(3)) after `exception.abort_message`,
    add column if not exists `exception.memory_error` String comment 'memory error report from gwp-asan or mte with allocation and deallocation stacks, as json' CODEC(ZSTD(3)) after `exception.cause`
settings mutations_sync = 2;

-- migrate:down
alter table events
    drop column if exists `exception.abort_message`,
    drop column if exists `exception.cause`,
    drop column if exists `exception.memory_error`
settings mutations_sync = 2;
