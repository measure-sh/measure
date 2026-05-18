-- migrate:up
alter table fatal_exception_groups
    add column if not exists handled Bool CODEC(ZSTD(3)) after line_number,
    add column if not exists is_custom Bool CODEC(ZSTD(3)) after handled,
    modify comment 'fatal exception groups';

-- migrate:down
alter table if exists fatal_exception_groups
    drop column if exists is_custom,
    drop column if exists handled,
    modify comment 'unhandled exception groups';

-- migrate:up
alter table fatal_exception_groups
  comment column if exists `handled` 'whether the exception was caught by application code',
  comment column if exists `is_custom` 'whether the exception was reported via custom capture API',
  comment column if exists `exception.meta` 'Exception metadata';

-- migrate:down
alter table fatal_exception_groups
  modify column if exists `handled` remove comment,
  modify column if exists `is_custom` remove comment;
