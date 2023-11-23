-- migrate:up
ALTER TABLE default.events
DROP COLUMN http_request.request_id,
DROP COLUMN http_request.request_url,
DROP COLUMN http_request.method,
DROP COLUMN http_request.http_protocol_version,
DROP COLUMN http_request.request_body_size,
DROP COLUMN http_request.request_body,
DROP COLUMN http_request.request_headers,
DROP COLUMN http_response.request_id,
DROP COLUMN http_response.request_url,
DROP COLUMN http_response.method,
DROP COLUMN http_response.latency_ms,
DROP COLUMN http_response.status_code,
DROP COLUMN http_response.response_body,
DROP COLUMN http_response.response_headers;


-- migrate:down
ALTER TABLE default.events
ADD COLUMN http_request.request_id UUID,
ADD COLUMN http_request.request_url String,
ADD COLUMN http_request.method LowCardinality(FixedString(16)),
ADD COLUMN http_request.http_protocol_version LowCardinality(FixedString(16)),
ADD COLUMN http_request.request_body_size UInt32,
ADD COLUMN http_request.request_body String,
ADD COLUMN http_request.request_headers Map(String, String),
ADD COLUMN http_response.request_id UUID,
ADD COLUMN http_response.request_url String,
ADD COLUMN http_response.method LowCardinality(FixedString(16)),
ADD COLUMN http_response.latency_ms UInt16,
ADD COLUMN http_response.status_code UInt16,
ADD COLUMN http_response.response_body String,
ADD COLUMN http_response.response_headers Map(String, String),
