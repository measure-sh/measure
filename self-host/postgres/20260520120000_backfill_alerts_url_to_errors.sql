-- migrate:up
UPDATE measure.alerts
SET url = REPLACE(REPLACE(url, '/crashes/', '/errors/'), '/anrs/', '/errors/')
WHERE url LIKE '%/crashes/%' OR url LIKE '%/anrs/%';

-- migrate:down
UPDATE measure.alerts
SET url = REGEXP_REPLACE(url, '/errors/', '/crashes/')
WHERE type IN ('new_crash', 'crash_spike');

UPDATE measure.alerts
SET url = REGEXP_REPLACE(url, '/errors/', '/anrs/')
WHERE type IN ('new_anr', 'anr_spike');
