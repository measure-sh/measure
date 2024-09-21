-- migrate:up
alter table events
add column if not exists `warm_launch.content_provider_attach_uptime` UInt64 after `warm_launch.process_start_requested_uptime`, comment column `warm_launch.content_provider_attach_uptime` 'start uptime in msec';

-- migrate:down
alter table events
drop column if exists `warm_launch.content_provider_attach_uptime`;
