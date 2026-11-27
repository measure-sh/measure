-- migrate:up
alter table events
  drop column if exists `string.severity_text`,
  drop column if exists `string.string`;

-- migrate:down
alter table events
  add column if not exists `string.severity_text` LowCardinality(String) comment 'log level - info, warning, error, fatal, debug' CODEC(ZSTD(3)) after `log.body`,
  add column if not exists `string.string` String comment 'log message text' CODEC(ZSTD(3)) after `string.severity_text`;
