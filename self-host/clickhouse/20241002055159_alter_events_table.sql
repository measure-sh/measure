-- migrate:up
alter table events
add column if not exists `screen_view.name` FixedString(128) after `navigation.source`, comment column `screen_view.name` 'name of the screen viewed';

-- migrate:down
alter table events
drop column if exists `screen_view.name`;
