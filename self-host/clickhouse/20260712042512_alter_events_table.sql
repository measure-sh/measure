-- migrate:up
alter table events
    add column if not exists `log.severity_text` LowCardinality(String) comment 'log level - info, warning, error, fatal, debug' CODEC(ZSTD(3)) after `app_exit.pid`,
    add column if not exists `log.severity_number` Int32 comment 'numeric severity for the log' CODEC(ZSTD(3)) after `log.severity_text`,
    add column if not exists `log.body` String comment 'log body text' CODEC(ZSTD(3)) after `log.severity_number`
settings mutations_sync = 2;

-- migrate:down
alter table events
    drop column if exists `log.severity_text`,
    drop column if exists `log.severity_number`,
    drop column if exists `log.body`
settings mutations_sync = 2;
