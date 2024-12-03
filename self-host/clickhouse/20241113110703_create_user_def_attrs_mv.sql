-- migrate:up
create materialized view user_def_attrs_mv to user_def_attrs as
select distinct app_id,
                id                                   as event_id,
                session_id,
                toLastDayOfMonth(timestamp)          as end_of_month,
                (toString(attribute.app_version),
                 toString(attribute.app_build))      as app_version,
                (toString(attribute.os_name),
                 toString(attribute.os_version))     as os_version,
                if(events.type = 'exception' and exception.handled = false,
                   true, false)                      as exception,
                if(events.type = 'anr', true, false) as anr,
                arr_key                              as key,
                tupleElement(arr_val, 1)             as type,
                tupleElement(arr_val, 2)             as value
from events
    array join
     mapKeys(user_defined_attribute) as arr_key,
     mapValues(user_defined_attribute) as arr_val
where length(user_defined_attribute) > 0
group by app_id, end_of_month, app_version, os_version, events.type,
         exception.handled, key, type, value, event_id, session_id
order by app_id;


-- migrate:down
drop view if exists user_def_attrs_mv;
