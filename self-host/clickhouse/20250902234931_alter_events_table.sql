-- migrate:up
alter table events
comment column if exists `warm_launch.content_provider_attach_uptime` 'start uptime in msec';

-- migrate:down
alter table events
modify column if exists `warm_launch.content_provider_attach_uptime` remove comment;
