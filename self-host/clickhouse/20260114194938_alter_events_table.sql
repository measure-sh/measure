-- migrate:up
alter table events
modify column if exists `attribute.device_manufacturer` FixedString(256);


-- migrate:down
select 1;
