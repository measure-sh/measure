-- migrate:up
create materialized view span_filters_mv to span_filters
(
    `team_id`             UUID,
    `app_id`              UUID,
    `end_of_month`        Date,
    `app_version`         String,
    `os_version`          String,
    `country_code`        LowCardinality(String),
    `network_provider`    LowCardinality(String),
    `network_type`        LowCardinality(String),
    `network_generation`  LowCardinality(String),
    `device_locale`       LowCardinality(String),
    `device_manufacturer` LowCardinality(String),
    `device_name`         LowCardinality(String)
)
as select distinct
    team_id,
    app_id,
    toLastDayOfMonth(start_time)   as end_of_month,
    attribute.app_version          as app_version,
    attribute.os_version           as os_version,
    attribute.country_code         as country_code,
    attribute.network_provider     as network_provider,
    attribute.network_type         as network_type,
    attribute.network_generation   as network_generation,
    attribute.device_locale        as device_locale,
    attribute.device_manufacturer  as device_manufacturer,
    attribute.device_name          as device_name
from spans
where toString(attribute.os_version) != ''
  and toString(attribute.country_code) != ''
  and toString(attribute.network_provider) != ''
  and toString(attribute.network_type) != ''
  and toString(attribute.network_generation) != ''
  and toString(attribute.device_locale) != ''
  and toString(attribute.device_manufacturer) != ''
  and toString(attribute.device_name) != ''
group by
    team_id,
    app_id,
    end_of_month,
    attribute.app_version,
    attribute.os_version,
    attribute.country_code,
    attribute.network_provider,
    attribute.network_type,
    attribute.network_generation,
    attribute.device_locale,
    attribute.device_manufacturer,
    attribute.device_name;


-- migrate:down
drop view if exists span_filters_mv;
