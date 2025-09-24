-- migrate:up
alter table events
    add column if not exists `custom.name` LowCardinality(FixedString(64)) after `screen_view.name`,
    add index if not exists custom_name_bloom_idx `custom.name` type bloom_filter granularity 2;


-- migrate:down
alter table events
  drop column if exists `custom.name`,
  drop index if exists custom_name_bloom_idx;
