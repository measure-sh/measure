create table if not exists roles (
    name varchar(256) primary key not null check (name in ('owner', 'admin', 'developer', 'viewer')),
    scopes text[]
);

comment on column roles.name is 'unique role name';
comment on column roles.scopes is 'valid scopes for this role';

-- seed data in to roles table
insert into roles(name, scopes) values
    ('owner', Array['billing:*', 'team:*', 'alert:*', 'app:*']),
    ('admin', Array['team:inviteSameOrLower', 'team:changeRoleSameOrLower', 'billing:*', 'alert:*', 'app:*']),
    ('developer', Array['team:inviteSameOrLower', 'team:changeRoleSameOrLower', 'alert:*', 'app:*']),
    ('viewer', Array['alert:read', 'team:read', 'team:inviteSameOrLower', 'app:read'])