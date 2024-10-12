-- migrate:up
alter table if exists event_reqs
  add status int default 0;

comment on column event_reqs.status is 'status of event request: 0 is pending, 1 is done';

update event_reqs set status = 1;

-- migrate:down
alter table if exists event_reqs
  drop if exists status;

