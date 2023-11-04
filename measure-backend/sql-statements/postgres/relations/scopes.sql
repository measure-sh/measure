create table if not exists scopes (
    name varchar(256) primary key not null
);

comment on column scopes.name is 'unique name of each scope. like, all, billing, team-invite and so on';