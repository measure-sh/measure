-- migrate:up
alter table events
comment column if exists user_defined_attribute 'user defined attributes';

-- migrate:down
alter table events
modify column if exists user_defined_attribute remove comment;
