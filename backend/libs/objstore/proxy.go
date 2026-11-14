package objstore

import (
	"fmt"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"unicode"
)

// attachmentCSP sandboxes any document an attachment response renders as.
const attachmentCSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"

// inlineTypes maps the extensions safe to render inline to their media type.
var inlineTypes = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif":  "image/gif",
	".svg":  "image/svg+xml",
}

// InlineType returns the media type for an extension from the inline set.
// The extension is matched case-insensitively & includes the dot.
func InlineType(ext string) (mediaType string, ok bool) {
	mediaType, ok = inlineTypes[strings.ToLower(ext)]
	return
}

// isInlineMediaType reports whether mediaType belongs to the inline set.
func isInlineMediaType(mediaType string) bool {
	for _, t := range inlineTypes {
		if t == mediaType {
			return true
		}
	}
	return false
}

// sanitizeFilename strips control characters & path separators from name.
// It returns "" when nothing usable remains.
func sanitizeFilename(name string) string {
	mapped := strings.Map(func(r rune) rune {
		switch {
		case unicode.IsControl(r):
			return -1
		case r == '\\' || r == '/':
			return '_'
		}
		return r
	}, name)

	if mapped == "." || mapped == ".." {
		return ""
	}
	return mapped
}

// AttachmentDisposition builds a Content-Disposition value of the given kind
// with the sanitized name as filename. It returns the bare kind when no usable
// name remains.
func AttachmentDisposition(kind, name string) string {
	clean := sanitizeFilename(name)
	if clean == "" {
		return kind
	}

	value := mime.FormatMediaType(kind, map[string]string{"filename": clean})
	if value == "" {
		return kind
	}
	return value
}

// upstreamFilename returns the filename param of an upstream Content-Disposition.
func upstreamFilename(disposition string) string {
	_, params, err := mime.ParseMediaType(disposition)
	if err != nil {
		return ""
	}
	return params["filename"]
}

// HardenAttachmentResponse sets a sandboxing CSP & nosniff on resp & makes
// Content-Disposition authoritative. It is inline only for image media types in
// the inline set & attachment otherwise. The upstream filename param is kept.
func HardenAttachmentResponse(resp *http.Response) {
	resp.Header.Set("Content-Security-Policy", attachmentCSP)
	resp.Header.Set("X-Content-Type-Options", "nosniff")

	kind := "attachment"
	if mediaType, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type")); err == nil && isInlineMediaType(mediaType) {
		kind = "inline"
	}

	name := upstreamFilename(resp.Header.Get("Content-Disposition"))
	resp.Header.Set("Content-Disposition", AttachmentDisposition(kind, name))
}

// ValidateProxyPayload validates and resolves a proxy payload URL against the
// configured object-store endpoint. It rejects requests when no endpoint is
// configured and verifies the resolved URL targets the expected host, guarding
// the attachment and symbol read proxies against SSRF.
func ValidateProxyPayload(payload, endpoint string) (*url.URL, error) {
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
