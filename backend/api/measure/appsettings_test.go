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

func TestNewAppSettings(t *testing.T) {
	// Setup
	appId := uuid.New()
	now := time.Now()

	// Act
	pref := newAppSettings(appId)

	// Assert
	if pref.AppId != appId {
		t.Errorf("appId mismatch: expected %v, got %v", appId, pref.AppId)
	}
	if pref.RetentionPeriod != 90 {
		t.Errorf("RetentionPeriod mismatch: expected %v, got %v", 90, pref.RetentionPeriod)
	}
	if pref.CreatedAt.Sub(now) > time.Second {
		t.Errorf("createdAt should be around current time")
	}
	if pref.UpdatedAt.Sub(now) > time.Second {
		t.Errorf("updatedAt should be around current time")
	}
}

func TestAppSettingsMarshalJSON(t *testing.T) {
	// Setup
	appId := uuid.New()
	retentionPeriod := uint32(60)
	createdAt := time.Date(2023, 4, 4, 12, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 4, 5, 12, 0, 0, 0, time.UTC)

	pref := AppSettings{
		AppId:           appId,
		RetentionPeriod: retentionPeriod,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
	}

	expectedJSON := fmt.Sprintf(`{
		"app_id": "%s",
        "retention_period": %d,
        "created_at": "2023-04-04T12:00:00Z",
        "updated_at": "2023-04-05T12:00:00Z"
    }`, appId, retentionPeriod)

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

func TestAppSettingsString(t *testing.T) {
	// Setup
	appId := uuid.New()
	retentionPeriod := uint32(365)
	createdAt := time.Date(2023, 4, 4, 12, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 4, 5, 12, 0, 0, 0, time.UTC)

	pref := AppSettings{
		AppId:           appId,
		RetentionPeriod: retentionPeriod,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
	}

	expectedString := fmt.Sprintf("AppSettings - app_id: %s, retention_period: %v, created_at: %s, updated_at: %s", appId, retentionPeriod, createdAt, updatedAt)

	// Act
	actualString := pref.String()

	trimmedExpectedString := strings.TrimSpace(expectedString)
	trimmedActualString := strings.TrimSpace(actualString)

	// Assert
	if trimmedActualString != trimmedExpectedString {
		t.Errorf("String() output mismatch:\nExpected: %s\nActual: %s", expectedString, actualString)
	}
}
