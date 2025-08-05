-- migrate:up
alter table events
modify column `screen_view.name` String;

-- migrate:down
alter table events
modify column `screen_view.name` FixedString(128);