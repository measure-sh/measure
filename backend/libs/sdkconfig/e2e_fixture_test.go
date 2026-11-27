package sdkconfig

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"
)

// e2eFixture is the config the e2e recorder serves on GET /config. It must
// match what a fresh e2e app gets from the backend, or recordings run the SDK
// with settings the live suite never sees.
const e2eFixture = "../../../e2e-tests/recording/sdk-config.json"

// TestE2EFixtureMatchesDefaults fails when the default config changes without
// the fixture. Regenerate with UPDATE_E2E_FIXTURE=1.
func TestE2EFixtureMatchesDefaults(t *testing.T) {
	config := createDefaultConfig()
	// Mirrors enableLogCollection in e2e-tests/runner/setup-apps.ts.
	config.LogAutocollectEnabled = true
	config.LogMinSeverity = 8

	raw, err := json.Marshal(config)
	if err != nil {
		t.Fatal(err)
	}
	var want bytes.Buffer
	if err := json.Indent(&want, raw, "", "  "); err != nil {
		t.Fatal(err)
	}
	want.WriteByte('\n')

	if os.Getenv("UPDATE_E2E_FIXTURE") != "" {
		if err := os.WriteFile(e2eFixture, want.Bytes(), 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}

	got, err := os.ReadFile(e2eFixture)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want.Bytes()) {
		t.Errorf("%s is stale; run with UPDATE_E2E_FIXTURE=1 and re-record", e2eFixture)
	}
}
