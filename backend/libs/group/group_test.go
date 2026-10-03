package group

import "testing"

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
