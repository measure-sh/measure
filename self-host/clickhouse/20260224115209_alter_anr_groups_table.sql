-- migrate:up
alter table anr_groups
  modify column if exists timestamp SimpleAggregateFunction(max, DateTime64(3, 'UTC'))
settings mutations_sync = 2;

-- migrate:down
alter table anr_groups
  modify column if exists timestamp DateTime64(3, 'UTC')
settings mutations_sync = 2;
