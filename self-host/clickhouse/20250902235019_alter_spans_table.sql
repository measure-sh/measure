-- migrate:up
alter table spans
comment column if exists user_defined_attribute 'user defined attributes';


-- migrate:down
alter table spans
modify column if exists user_defined_attribute remove comment;
