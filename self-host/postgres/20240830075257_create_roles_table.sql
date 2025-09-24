-- migrate:up
create table if not exists measure.roles (
    name varchar(256) primary key not null check (name in ('owner', 'admin', 'developer', 'viewer'))
);

comment on column measure.roles.name is 'unique role name';

-- seed data in to roles table
insert into measure.roles(name) values
    ('owner'),
    ('admin'),
    ('developer'),
    ('viewer')

-- migrate:down
drop table if exists measure.roles;
