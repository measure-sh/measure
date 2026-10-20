package group

import (
	"testing"
	"time"

	"backend/libs/event"

	"github.com/google/uuid"
)

func TestNewAppHangGroup(t *testing.T) {
	appID := uuid.New()
	attribute := event.Attribute{AppVersion: "1.0.3", AppBuild: "7", OSName: "ios"}
	timestamp := time.Now()

	g := NewAppHangGroup(appID, "IN", attribute, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "blockMainThread()", "ViewController.swift", 319, timestamp)

	if g.AppID != appID {
		t.Errorf("Expected app id %v, but got %v", appID, g.AppID)
	}
	if g.CountryCode != "IN" {
		t.Errorf("Expected country code %q, but got %q", "IN", g.CountryCode)
	}
	if g.Attribute != attribute {
		t.Errorf("Expected attribute %+v, but got %+v", attribute, g.Attribute)
	}
	if g.ID != "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" || g.GetId() != g.ID {
		t.Errorf("Expected id %q, but got %q", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", g.ID)
	}
	if g.MethodName != "blockMainThread()" {
		t.Errorf("Expected method name %q, but got %q", "blockMainThread()", g.MethodName)
	}
	if g.FileName != "ViewController.swift" {
		t.Errorf("Expected file name %q, but got %q", "ViewController.swift", g.FileName)
	}
	if g.LineNumber != 319 {
		t.Errorf("Expected line number %d, but got %d", 319, g.LineNumber)
	}
	if !g.UpdatedAt.Equal(timestamp) {
		t.Errorf("Expected timestamp %v, but got %v", timestamp, g.UpdatedAt)
	}
}

func TestANRGroupGetDisplayTitle(t *testing.T) {
	t.Run("Joins type and file name", func(t *testing.T) {
		g := ANRGroup{Type: "Input dispatching timed out", FileName: "Repo.kt"}
		if got, want := g.GetDisplayTitle(), "Input dispatching timed out@Repo.kt"; got != want {
			t.Errorf("Expected display title %q, but got %q", want, got)
		}
	})

	t.Run("Omits the separator when there is no type", func(t *testing.T) {
		g := ANRGroup{FileName: "Repo.kt"}
		if got, want := g.GetDisplayTitle(), "Repo.kt"; got != want {
			t.Errorf("Expected display title %q, but got %q", want, got)
		}
	})

	t.Run("Omits the separator when there is no file name", func(t *testing.T) {
		g := ANRGroup{Type: "Input dispatching timed out"}
		if got, want := g.GetDisplayTitle(), "Input dispatching timed out"; got != want {
			t.Errorf("Expected display title %q, but got %q", want, got)
		}
	})
}
