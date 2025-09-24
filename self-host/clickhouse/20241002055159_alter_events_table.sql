-- migrate:up
alter table events
add column if not exists `screen_view.name` FixedString(128) after `navigation.source`;

-- migrate:down
alter table events
drop column if exists `screen_view.name`;
