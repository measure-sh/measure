-- migrate:up
alter table measure.sdk_config
  add column if not exists ttid_trace_enabled boolean not null default true;

comment on column measure.sdk_config.ttid_trace_enabled is 'whether to collect screen load (TTID) spans';

-- migrate:down
alter table measure.sdk_config
  drop column if exists ttid_trace_enabled;
