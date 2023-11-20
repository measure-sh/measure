-- migrate:up
ALTER TABLE default.events
ADD COLUMN anr.network_type LowCardinality(FixedString(16)),
ADD COLUMN anr.network_generation LowCardinality(FixedString(8)),
ADD COLUMN anr.network_provider FixedString(64),
ADD COLUMN exception.network_type LowCardinality(FixedString(16)),
ADD COLUMN exception.network_generation LowCardinality(FixedString(8)),
ADD COLUMN exception.network_provider FixedString(64);

-- migrate:down
ALTER TABLE default.events
DROP COLUMN anr.network_type,
DROP COLUMN anr.network_generation,
DROP COLUMN anr.network_provider,
DROP COLUMN exception.network_type,
DROP COLUMN exception.network_generation,
DROP COLUMN exception.network_provider;
