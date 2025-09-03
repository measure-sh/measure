-- migrate:up
alter table events
add column if not exists `warm_launch.process_start_requested_uptime` UInt64 after `warm_launch.process_start_uptime`;

-- migrate:down
alter table events
drop column if exists `warm_launch.process_start_requested_uptime`;
