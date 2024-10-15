-- migrate:up
alter table default.events
modify column if exists `attribute.thread_name` FixedString(128);


-- migrate:down
select 1;
