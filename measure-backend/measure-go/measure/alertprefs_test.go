package measure

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestNewAlertPref(t *testing.T) {
	// Setup
	appID := uuid.New()
	now := time.Now()

	// Act
	pref, err := newAlertPref(appID)
	if err != nil {
		t.Errorf("NewAlertPref failed: %v", err)
		return
	}

	// Assert
	if pref.AppId != appID {
		t.Errorf("appId mismatch: expected %v, got %v", appID, pref.AppId)
	}
	if !pref.CrashRateSpikeEmail {
		t.Errorf("crashRateSpikeEmail should be true")
	}
	if pref.CrashRateSpikeSlack {
		t.Errorf("crashRateSpikeSlack should be false")
	}
	if !pref.AnrRateSpikeEmail {
		t.Errorf("anrRateSpikeEmail should be true")
	}
	if pref.AnrRateSpikeSlack {
		t.Errorf("anrRateSpikeSlack should be false")
	}
	if !pref.LaunchTimeSpikeEmail {
		t.Errorf("launchTimeSpikeEmail should be true")
	}
	if pref.LaunchTimeSpikeSlack {
		t.Errorf("launchTimeSpikeSlack should be false")
	}
	if pref.CreatedAt.Sub(now) > time.Second {
		t.Errorf("createdAt should be around current time")
	}
	if pref.UpdatedAt.Sub(now) > time.Second {
		t.Errorf("updatedAt should be around current time")
	}
}

func TestAlertPrefMarshalJSON(t *testing.T) {
	// Setup
	appID := uuid.New()
	createdAt := time.Date(2023, 4, 4, 12, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 4, 5, 12, 0, 0, 0, time.UTC)

	pref := AlertPref{
		AppId:                appID,
		CrashRateSpikeEmail:  true,
		CrashRateSpikeSlack:  false,
		AnrRateSpikeEmail:    false,
		AnrRateSpikeSlack:    true,
		LaunchTimeSpikeEmail: false,
		LaunchTimeSpikeSlack: false,
		CreatedAt:            createdAt,
		UpdatedAt:            updatedAt,
	}

	expectedJSON := `{
        "crash_rate_spike": {
            "email": true,
            "slack": false
        },
        "anr_rate_spike": {
            "email": false,
            "slack": true
        },
        "launch_time_spike": {
            "email": false,
            "slack": false
        },
        "created_at": "2023-04-04T12:00:00Z",
        "updated_at": "2023-04-05T12:00:00Z"
    }`

	// Act
	jsonBytes, err := pref.MarshalJSON()
	if err != nil {
		t.Errorf("MmarshalJson failed: %v", err)
		return
	}
	jsonStr := string(jsonBytes)

	// Assert
	var expectedMap, actualMap map[string]interface{}
	if err := json.Unmarshal([]byte(expectedJSON), &expectedMap); err != nil {
		t.Errorf("Failed to unmarshal expected JSON: %v", err)
		return
	}
	if err := json.Unmarshal(jsonBytes, &actualMap); err != nil {
		t.Errorf("Failed to unmarshal actual JSON: %v", err)
		return
	}

	if !reflect.DeepEqual(expectedMap, actualMap) {
		t.Errorf("JSON output mismatch:\nExpected: %s\nActual: %s", expectedJSON, jsonStr)
	}
}

func TestAlertPrefString(t *testing.T) {
	// Setup
	appID := uuid.New()
	createdAt := time.Date(2023, 4, 4, 12, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 4, 5, 12, 0, 0, 0, time.UTC)

	pref := AlertPref{
		AppId:                appID,
		CrashRateSpikeEmail:  true,
		CrashRateSpikeSlack:  false,
		AnrRateSpikeEmail:    false,
		AnrRateSpikeSlack:    true,
		LaunchTimeSpikeEmail: true,
		LaunchTimeSpikeSlack: false,
		CreatedAt:            createdAt,
		UpdatedAt:            updatedAt,
	}

	expectedString := fmt.Sprintf("AlertPref - appId: %s, crash_rate_spike_email: true, crash_rate_spike_slack: false, anr_rate_spike_email: false, anr_rate_spike_slack: true, launch_time_spike_email: true, launch_time_spike_slack: false, created_at: %s, updated_at: %s", appID, createdAt, updatedAt)

	// Act
	actualString := pref.String()

	trimmedExpectedString := strings.TrimSpace(expectedString)
	trimmedActualString := strings.TrimSpace(actualString)

	// Assert
	if trimmedActualString != trimmedExpectedString {
		t.Errorf("String() output mismatch:\nExpected: %s\nActual: %s", expectedString, actualString)
	}
}
