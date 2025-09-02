-- migrate:up
alter table events
comment column if exists `warm_launch.is_lukewarm` 'whether it is a lukewarm launch';

-- migrate:down
alter table events
modify column if exists `warm_launch.is_lukewarm` remove comment;
