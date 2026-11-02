-- migrate:up
alter table events
modify column if exists `warm_launch.app_visible_uptime` codec(T64, ZSTD(3));

-- migrate:down
alter table events
modify column if exists `warm_launch.app_visible_uptime` remove codec;
