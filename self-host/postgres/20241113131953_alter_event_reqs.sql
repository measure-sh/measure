-- migrate:up
alter table if exists event_reqs
  add span_count int default 0;

comment on column event_reqs.span_count is 'number of spans in the event request';

update event_reqs set span_count = 0;

-- migrate:down
alter table if exists event_reqs
  drop if exists span_count;