package seed

import "testing"

func TestLatestURLs(t *testing.T) {

	fw := NewAppleFramework()

	latest := fw.getLatestURLs()

	expected := 1
	got := len(latest)

	if got < expected {
		t.Errorf("Expected %v latest URLs, but got %v", expected, got)
	}
}

func TestBetaURLs(t *testing.T) {
	fw := NewAppleFramework()

	beta := fw.getBetaURLs()

	expected := 1
	got := len(beta)

	if got < expected {
		t.Errorf("Expected %v beta URLs, but got %v", expected, got)
	}
}
