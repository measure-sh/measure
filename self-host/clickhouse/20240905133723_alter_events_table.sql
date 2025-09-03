-- migrate:up
alter table events
modify column if exists `gesture_long_click.touch_down_time` UInt64,
modify column if exists `gesture_long_click.touch_up_time` UInt64,
modify column if exists `gesture_click.touch_down_time` UInt64,
modify column if exists `gesture_click.touch_up_time` UInt64,
modify column if exists `gesture_scroll.touch_down_time` UInt64,
modify column if exists `gesture_scroll.touch_up_time` UInt64,
modify column if exists `cold_launch.process_start_uptime` UInt64,
modify column if exists `cold_launch.process_start_requested_uptime` UInt64,
modify column if exists `cold_launch.content_provider_attach_uptime` UInt64,
modify column if exists `cold_launch.on_next_draw_uptime` UInt64,
modify column if exists `warm_launch.app_visible_uptime` UInt64,
modify column if exists `warm_launch.on_next_draw_uptime` UInt64,
modify column if exists `hot_launch.app_visible_uptime` UInt64,
modify column if exists `hot_launch.on_next_draw_uptime` UInt64,
modify column if exists `memory_usage.interval` UInt64,
modify column if exists `cpu_usage.interval` UInt64;

-- migrate:down
alter table events
modify column if exists `gesture_long_click.touch_down_time` UInt32,
modify column if exists `gesture_long_click.touch_up_time` UInt32,
modify column if exists `gesture_click.touch_down_time` UInt32,
modify column if exists `gesture_click.touch_up_time` UInt32,
modify column if exists `gesture_scroll.touch_down_time` UInt32,
modify column if exists `gesture_scroll.touch_up_time` UInt32,
modify column if exists `cold_launch.process_start_uptime` UInt32,
modify column if exists `cold_launch.process_start_requested_uptime` UInt32,
modify column if exists `cold_launch.content_provider_attach_uptime` UInt32,
modify column if exists `cold_launch.on_next_draw_uptime` UInt32,
modify column if exists `warm_launch.app_visible_uptime` UInt32,
modify column if exists `warm_launch.on_next_draw_uptime` UInt32,
modify column if exists `hot_launch.app_visible_uptime` UInt32,
modify column if exists `hot_launch.on_next_draw_uptime` UInt32,
modify column if exists `memory_usage.interval` UInt32,
modify column if exists `cpu_usage.interval` UInt32;
