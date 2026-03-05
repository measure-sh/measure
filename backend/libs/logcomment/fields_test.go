package logcomment

import (
	"strings"
	"testing"
)

func TestIsValidKey(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"team", true},
		{"team_1", true},
		{"TEAM", true},
		{"t123", true},
		{"", false},
		{"team-id", false},
		{"team id", false},
		{"team$", false},
		{"équipe", false},
	}

	for _, c := range cases {
		if got := isValidKey(c.in); got != c.want {
			t.Errorf("isValidKey(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestIsValidValue(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"42", true},
		{"funnels", true},
		{"/api/events", true},
		{"abc123", true},
		{"", false},
		{"has space", false},
		{"a=b", false},
	}

	for _, c := range cases {
		if got := isValidValue(c.in); got != c.want {
			t.Errorf("isValidValue(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestPutAndGet(t *testing.T) {
	f := New(2)

	if err := f.Put("team", "42"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := f.Put("feat", "funnels"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if v, ok := f.Get("team"); !ok || v != "42" {
		t.Fatalf("Get(team) = %q,%v", v, ok)
	}

	if err := f.Put("bad-key", "x"); err == nil {
		t.Fatal("expected error for invalid key")
	}
	if err := f.Put("ok", "bad value"); err == nil {
		t.Fatal("expected error for invalid value")
	}
}

func TestMustPutPanics(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic")
		}
	}()

	New(1).MustPut("bad key", "x")
}

func TestStringSorted(t *testing.T) {
	f := New(3).
		MustPut("team", "42").
		MustPut("feat", "funnels").
		MustPut("route", "/api")

	s := f.StringSorted()
	want := "feat=funnels route=/api team=42"

	if s != want {
		t.Fatalf("StringSorted() = %q, want %q", s, want)
	}
}

func TestStringFastContainsAll(t *testing.T) {
	f := New(2).
		MustPut("a", "1").
		MustPut("b", "2")

	s := f.String()

	if !strings.Contains(s, "a=1") || !strings.Contains(s, "b=2") {
		t.Fatalf("String() = %q, missing fields", s)
	}
	if strings.Count(s, " ") != 1 {
		t.Fatalf("String() = %q, expected one space", s)
	}
}

func TestParseBasic(t *testing.T) {
	in := "team=42 feat=funnels route=/api"

	f, err := Parse(in, 3)
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}

	if v, _ := f.Get("team"); v != "42" {
		t.Fatalf("team = %q", v)
	}
	if v, _ := f.Get("feat"); v != "funnels" {
		t.Fatalf("feat = %q", v)
	}
	if v, _ := f.Get("route"); v != "/api" {
		t.Fatalf("route = %q", v)
	}
}

func TestParseInvalid(t *testing.T) {
	cases := []string{
		"novalue",
		"=x",
		"k=",
		"bad key=x",
		"a=b c",
	}

	for _, in := range cases {
		if _, err := Parse(in, 2); err == nil {
			t.Fatalf("expected error for %q", in)
		}
	}
}

func TestRoundTripSorted(t *testing.T) {
	orig := New(3).
		MustPut("team", "42").
		MustPut("feat", "funnels").
		MustPut("req", "abc123")

	s := orig.StringSorted()

	parsed, err := Parse(s, 3)
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}

	for k, v := range orig.m {
		if got, ok := parsed.Get(k); !ok || got != v {
			t.Fatalf("round-trip mismatch for %s: %q vs %q", k, v, got)
		}
	}
}

func BenchmarkAddAndString(b *testing.B) {
	for b.Loop() {
		f := New(4)
		_ = f.Put("team", "42")
		_ = f.Put("feat", "funnels")
		_ = f.Put("route", "/api/events")
		_ = f.Put("req", "abc123")
		_ = f.String()
	}
}

func BenchmarkParse(b *testing.B) {
	s := "team=42 feat=funnels route=/api/events req=abc123"

	for b.Loop() {
		if _, err := Parse(s, 4); err != nil {
			b.Fatal(err)
		}
	}
}
