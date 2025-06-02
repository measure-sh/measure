-- migrate:up
alter table events
comment column if exists `warm_launch.process_start_uptime` 'start uptime in msec';

-- migrate:down
alter table events
modify column if exists `warm_launch.process_start_uptime` remove comment;
