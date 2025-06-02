-- migrate:up
alter table events
add column if not exists `warm_launch.process_start_uptime` UInt64 after `warm_launch.app_visible_uptime`;

-- migrate:down
alter table events
drop column if exists `warm_launch.process_start_uptime`;
