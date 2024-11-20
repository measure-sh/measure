-- migrate:up
create or replace dictionary if not exists user_def_attrs_dict
(
    event_id   UUID,
    key        String,
    type       String,
    value      String
)
primary key event_id, key
source (CLICKHOUSE(query
       'select event_id, key, type, value from user_def_attrs'))
lifetime (min 1 max 100)
layout (COMPLEX_KEY_CACHE(size_in_cells 1000))
comment 'event mapped user defined attribute dictionary';


-- migrate:down
drop dictionary if exists user_def_attrs_dict;
