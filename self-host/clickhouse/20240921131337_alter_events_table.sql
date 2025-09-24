-- migrate:up
alter table events
add column if not exists `warm_launch.is_lukewarm` Boolean after `warm_launch.duration`;

-- migrate:down
alter table events
drop column if exists `warm_launch.is_lukewarm`;
