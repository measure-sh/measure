package measure

import (
	"fmt"
	"net/url"
	"strings"
)

// validateProxyPayload validates and resolves a proxy payload
// URL against the configured AWS endpoint. It rejects requests
// when no endpoint is configured and verifies the resolved URL
// targets the expected host.
func validateProxyPayload(payload, endpoint string) (*url.URL, error) {
	if endpoint == "" {
		return nil, fmt.Errorf("object store endpoint not configured")
	}

	presignedUrl := payload
	if !strings.HasPrefix(payload, endpoint) {
		presignedUrl = endpoint + payload
	}

	parsed, err := url.Parse(presignedUrl)
	if err != nil {
		return nil, fmt.Errorf("failed to parse presigned url: %w", err)
	}

	endpointParsed, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to parse endpoint: %w", err)
	}

	if parsed.Host != endpointParsed.Host {
		return nil, fmt.Errorf("payload host does not match endpoint")
	}

	return parsed, nil
}
