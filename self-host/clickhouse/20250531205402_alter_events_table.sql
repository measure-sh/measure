-- migrate:up
alter table events
comment column if exists `screen_view.name` 'name of the screen viewed';


-- migrate:down
alter table events
modify column if exists `screen_view.name` remove comment;
