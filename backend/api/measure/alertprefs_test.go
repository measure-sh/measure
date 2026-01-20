//go:build integration

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
	appId := uuid.New()
	userId := uuid.New()
	now := time.Now()

	// Act
	pref := newAlertPref(appId, userId)

	// Assert
	if pref.AppId != appId {
		t.Errorf("appId mismatch: expected %v, got %v", appId, pref.AppId)
	}
	if pref.UserId != userId {
		t.Errorf("userId mismatch: expected %v, got %v", userId, pref.UserId)
	}
	if !pref.CrashRateSpikeEmail {
		t.Errorf("crashRateSpikeEmail should be true")
	}
	if !pref.AnrRateSpikeEmail {
		t.Errorf("anrRateSpikeEmail should be true")
	}
	if !pref.LaunchTimeSpikeEmail {
		t.Errorf("launchTimeSpikeEmail should be true")
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
	appId := uuid.New()
	userId := uuid.New()
	createdAt := time.Date(2023, 4, 4, 12, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 4, 5, 12, 0, 0, 0, time.UTC)

	pref := AlertPref{
		AppId:                appId,
		UserId:               userId,
		CrashRateSpikeEmail:  true,
		AnrRateSpikeEmail:    false,
		LaunchTimeSpikeEmail: false,
		CreatedAt:            createdAt,
		UpdatedAt:            updatedAt,
	}

	expectedJSON := `{
        "crash_rate_spike": {
            "email": true
        },
        "anr_rate_spike": {
            "email": false
        },
        "launch_time_spike": {
            "email": false
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
	appId := uuid.New()
	userId := uuid.New()
	createdAt := time.Date(2023, 4, 4, 12, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 4, 5, 12, 0, 0, 0, time.UTC)

	pref := AlertPref{
		AppId:                appId,
		UserId:               userId,
		CrashRateSpikeEmail:  true,
		AnrRateSpikeEmail:    false,
		LaunchTimeSpikeEmail: true,
		CreatedAt:            createdAt,
		UpdatedAt:            updatedAt,
	}

	expectedString := fmt.Sprintf("AlertPref - appId: %s, userId: %s, crash_rate_spike_email: true, anr_rate_spike_email: false, launch_time_spike_email: true, created_at: %s, updated_at: %s", appId, userId, createdAt, updatedAt)

	// Act
	actualString := pref.String()

	trimmedExpectedString := strings.TrimSpace(expectedString)
	trimmedActualString := strings.TrimSpace(actualString)

	// Assert
	if trimmedActualString != trimmedExpectedString {
		t.Errorf("String() output mismatch:\nExpected: %s\nActual: %s", expectedString, actualString)
	}
}
