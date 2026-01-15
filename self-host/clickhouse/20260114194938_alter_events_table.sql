-- migrate:up
alter table events
drop index if exists attribute_device_manufacturer_idx;

-- migrate:down
alter table events
add index if not exists attribute_device_manufacturer_idx  `attribute.device_manufacturer` TYPE minmax GRANULARITY 2 after attribute_device_name_idx;

-- migrate:up
alter table events
modify column if exists `attribute.device_manufacturer` FixedString(256);

-- migrate:down
select 1;

-- migrate:up
alter table events
add index if not exists attribute_device_manufacturer_idx `attribute.device_manufacturer` type minmax granularity 2 after attribute_device_name_idx;

-- migrate:down
alter table events
drop index if exists attribute_device_manufacturer_idx;
