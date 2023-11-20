-- migrate:up
ALTER TABLE default.events
ADD COLUMN resource.network_type LowCardinality(FixedString(16)),
ADD COLUMN resource.network_generation LowCardinality(FixedString(8)),
ADD COLUMN resource.network_provider FixedString(64);

-- migrate:down
ALTER TABLE default.events
DROP COLUMN resource.network_type,
DROP COLUMN resource.network_generation,
DROP COLUMN resource.network_provider;
