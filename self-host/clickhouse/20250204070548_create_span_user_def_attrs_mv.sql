-- migrate:up
create materialized view span_user_def_attrs_mv to span_user_def_attrs as
select distinct app_id,
                span_id,
                session_id,
                toLastDayOfMonth(start_time)         as end_of_month,
                attribute.app_version                as app_version,
                attribute.os_version                 as os_version,
                arr_key                              as key,
                tupleElement(arr_val, 1)             as type,
                tupleElement(arr_val, 2)             as value
from spans
    array join
     mapKeys(user_defined_attribute) as arr_key,
     mapValues(user_defined_attribute) as arr_val
where length(user_defined_attribute) > 0
group by app_id, end_of_month, app_version, os_version, 
        key, type, value, span_id, session_id
order by app_id;


-- migrate:down
drop view if exists span_user_def_attrs_mv;
