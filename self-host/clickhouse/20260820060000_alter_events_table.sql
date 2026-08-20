-- migrate:up
alter table events
    add column if not exists `exception.has_num_code` Bool comment 'true if the sdk sent exception.num_code' CODEC(ZSTD(3)) after `exception.num_code`
settings mutations_sync = 2;

-- migrate:down
alter table events
    drop column if exists `exception.has_num_code`
settings mutations_sync = 2;
