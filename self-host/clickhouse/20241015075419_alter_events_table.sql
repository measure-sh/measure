-- migrate:up
alter table default.events
modify column if exists `attribute.app_version` FixedString(128);

-- migrate:down
select 1;
