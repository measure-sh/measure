-- migrate:up
alter table events
  rename column if exists `profile.reason` to `profile.trigger`;

-- migrate:down
alter table events
  rename column if exists `profile.trigger` to `profile.reason`;
