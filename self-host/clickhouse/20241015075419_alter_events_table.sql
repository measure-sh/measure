-- migrate:up
alter table default.events
modify column if exists `attribute.app_version` FixedString(64);

-- migrate:down
select 1;
