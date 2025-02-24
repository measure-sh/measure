package symbol

import (
	"backend/api/event"
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestEventBatching(t *testing.T) {
	var events []event.EventField
	appId, _ := uuid.Parse("06b6d6bf-99d1-4536-8f94-1cea038cf207")
	logString := event.EventField{
		AppID: appId,
		Type:  event.TypeString,
		Attribute: event.Attribute{
			AppVersion: "1.0.0",
			AppBuild:   "1000",
		},
	}

	gestureClick := event.EventField{
		AppID: appId,
		Type:  event.TypeGestureClick,
		Attribute: event.Attribute{
			AppVersion: "1.0.0",
			AppBuild:   "1000",
		},
	}

	coldLaunch := event.EventField{
		AppID: appId,
		Type:  event.TypeColdLaunch,
		Attribute: event.Attribute{
			AppVersion: "2.0.0",
			AppBuild:   "1000",
		},
	}

	events = append(events, logString, gestureClick, coldLaunch)
	store, _ := pgxpool.New(context.Background(), "")

	symbolicator, _ := NewSymbolicator(&Options{
		Origin: "http://example.com",
		Store:  store,
	})

	batches := symbolicator.Batch(events)

	expectedLenA := 2
	gotLenA := len(batches)
	if len(batches) != expectedLenA {
		t.Errorf("Expected %d batches, got %d", expectedLenA, gotLenA)
	}

	expectedLenB := 2
	gotLenB := len(batches[0].Events)
	if expectedLenB != gotLenB {
		t.Errorf(`Expected %d, but got %d`, expectedLenB, gotLenB)
	}

	expectedLenC := 1
	gotLenC := len(batches[1].Events)
	if expectedLenC != gotLenC {
		t.Errorf(`Expected %d, but got %d`, expectedLenC, gotLenC)
	}

	expectedTypeA := event.TypeString
	gotTypeA := batches[0].Events[0].Type
	if expectedTypeA != gotTypeA {
		t.Errorf(`Expected %s, but got %s`, expectedTypeA, gotTypeA)
	}

	expectedTypeB := event.TypeGestureClick
	gotTypeB := batches[0].Events[1].Type
	if expectedTypeB != gotTypeB {
		t.Errorf(`Expected %s, but got %s`, expectedTypeB, gotTypeB)
	}

	expectedTypeC := event.TypeColdLaunch
	gotTypeC := batches[1].Events[0].Type
	if expectedTypeC != gotTypeC {
		t.Errorf(`Expected %s, but got %s`, expectedTypeC, gotTypeC)
	}
}

func TestMappingKeyString(t *testing.T) {
	appId, _ := uuid.Parse("f1246218-0ea8-4b80-8b40-2cf1c837478c")
	keyIdA := MappingKeyID{
		appId:       appId,
		versionName: "1.0.0",
		versionCode: "1000",
		mappingType: TypeProguard.String(),
	}

	expectedA := "f1246218-0ea8-4b80-8b40-2cf1c837478c/1.0.0/1000/proguard"
	gotA := keyIdA.String()
	if expectedA != gotA {
		t.Errorf(`Expected %s, but got %s`, expectedA, gotA)
	}
}
