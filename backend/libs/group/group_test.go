package group

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"

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

func TestNewExceptionGroupMessage(t *testing.T) {
	newGroup := func(message string) *ExceptionGroup {
		return NewExceptionGroup(uuid.New(), "IN", event.Attribute{}, "fp", "Err", message, "m", "f", 1, false, true, false, time.Now())
	}

	t.Run("caps oversized message", func(t *testing.T) {
		g := newGroup(strings.Repeat("a", 9000))
		if len(g.Message) != 8192 {
			t.Errorf("Expected 8192 bytes, but got %d", len(g.Message))
		}
	})

	t.Run("caps multi-byte message on a rune boundary", func(t *testing.T) {
		g := newGroup(strings.Repeat("a", 8191) + strings.Repeat("é", 10))
		if len(g.Message) > 8192 {
			t.Errorf("Expected at most 8192 bytes, but got %d", len(g.Message))
		}
		if !utf8.ValidString(g.Message) {
			t.Error("Expected valid UTF-8 message")
		}
	})

	t.Run("keeps short message", func(t *testing.T) {
		g := newGroup("boom")
		if g.Message != "boom" {
			t.Errorf("Expected %q, but got %q", "boom", g.Message)
		}
	})
}
