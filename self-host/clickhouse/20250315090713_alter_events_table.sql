-- migrate:up
alter table events
modify column if exists `cpu_usage.clock_speed` UInt64;

-- migrate:down
select 1;
