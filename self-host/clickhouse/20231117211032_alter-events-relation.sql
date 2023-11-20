-- migrate:up
ALTER TABLE default.events
ADD COLUMN network_change.network_type LowCardinality(FixedString(16)),
ADD COLUMN network_change.previous_network_type LowCardinality(FixedString(16)),
ADD COLUMN network_change.network_generation LowCardinality(FixedString(8)),
ADD COLUMN network_change.previous_network_generation LowCardinality(FixedString(8)),
ADD COLUMN network_change.network_provider FixedString(64);

-- migrate:down
ALTER TABLE default.events
DROP COLUMN network_change.network_type,
DROP COLUMN network_change.previous_network_type,
DROP COLUMN network_change.network_generation,
DROP COLUMN network_change.previous_network_generation,
DROP COLUMN network_change.network_provider;
