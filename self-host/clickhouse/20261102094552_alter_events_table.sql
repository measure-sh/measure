-- migrate:up
alter table events
comment column if exists `lifecycle_app.type` 'type of the lifecycle app, either - background, foreground, terminated';

-- migrate:down
alter table events
comment column if exists `lifecycle_app.type` 'type of the lifecycle app, either - background, foreground';
