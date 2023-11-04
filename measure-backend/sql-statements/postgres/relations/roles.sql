create table if not exists roles (
    name varchar(256) primary key not null check (name in ('owner', 'admin', 'developer', 'viewer')),
    scopes varchar(256) not null check (scopes in ('all', 'billing', 'invite', 'apps', 'viz'))
);

comment on column roles.name is 'unique role name';
comment on column roles.scopes is 'all valid scopes';