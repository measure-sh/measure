-- migrate:up
alter table spans drop column if exists `attribute.platform`;

-- migrate:down
alter table spans add column if not exists `attribute.platform` LowCardinality(String) comment 'platform identifier' CODEC(ZSTD(3)) after `attribute.os_version`;
