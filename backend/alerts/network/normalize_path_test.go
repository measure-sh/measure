package network

import "testing"

func TestNormalizePath_StaticPathUnchanged(t *testing.T) {
	got := normalizePath("/api/v1/users")
	if got != "/api/v1/users" {
		t.Errorf("normalizePath(%q) = %q, want %q", "/api/v1/users", got, "/api/v1/users")
	}
}

func TestNormalizePath_UUIDBecomesWildcard(t *testing.T) {
	got := normalizePath("/api/users/550e8400-e29b-41d4-a716-446655440000/profile")
	if got != "/api/users/*/profile" {
		t.Errorf("got %q, want %q", got, "/api/users/*/profile")
	}

	got = normalizePath("/api/users/550E8400-E29B-41D4-A716-446655440000")
	if got != "/api/users/*" {
		t.Errorf("uppercase UUID: got %q, want %q", got, "/api/users/*")
	}
}

func TestNormalizePath_SHA1BecomesWildcard(t *testing.T) {
	got := normalizePath("/commits/da39a3ee5e6b4b0d3255bfef95601890afd80709")
	if got != "/commits/*" {
		t.Errorf("got %q, want %q", got, "/commits/*")
	}
}

func TestNormalizePath_MD5BecomesWildcard(t *testing.T) {
	got := normalizePath("/files/d41d8cd98f00b204e9800998ecf8427e")
	if got != "/files/*" {
		t.Errorf("got %q, want %q", got, "/files/*")
	}
}

func TestNormalizePath_DateBecomesWildcard(t *testing.T) {
	got := normalizePath("/events/2024-01-15T/details")
	if got != "/events/*/details" {
		t.Errorf("got %q, want %q", got, "/events/*/details")
	}
}

func TestNormalizePath_HexBecomesWildcard(t *testing.T) {
	got := normalizePath("/data/0x1a2b3c")
	if got != "/data/*" {
		t.Errorf("got %q, want %q", got, "/data/*")
	}
}

func TestNormalizePath_MultiDigitIntegerBecomesWildcard(t *testing.T) {
	got := normalizePath("/users/12345/orders")
	if got != "/users/*/orders" {
		t.Errorf("got %q, want %q", got, "/users/*/orders")
	}
}

func TestNormalizePath_SingleDigitPreserved(t *testing.T) {
	got := normalizePath("/api/v1/users/3")
	if got != "/api/v1/users/3" {
		t.Errorf("got %q, want %q", got, "/api/v1/users/3")
	}
}

func TestNormalizePath_MixedStaticAndDynamicSegments(t *testing.T) {
	got := normalizePath("/api/users/550e8400-e29b-41d4-a716-446655440000/orders/12345")
	if got != "/api/users/*/orders/*" {
		t.Errorf("got %q, want %q", got, "/api/users/*/orders/*")
	}
}

func TestNormalizePath_EmptyPath(t *testing.T) {
	got := normalizePath("")
	if got != "" {
		t.Errorf("got %q, want %q", got, "")
	}
}
