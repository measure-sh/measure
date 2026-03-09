-- migrate:up
alter table spans
    drop index if exists user_defined_attribute_key_minmax_idx;

-- migrate:down
alter table spans
    add index if not exists user_defined_attribute_key_minmax_idx mapKeys(user_defined_attribute) type minmax granularity 16;
