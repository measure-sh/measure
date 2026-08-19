package alertmsg

import "testing"

func TestCrashSpikeMessage(t *testing.T) {
	got := CrashSpikeMessage("Foo.kt", "<init>", "x < 1")
	want := "Crashes are spiking at:\n\nFoo.kt: <init>() - x < 1"
	if got != want {
		t.Errorf("CrashSpikeMessage = %q, want %q", got, want)
	}
}

func TestAnrSpikeMessage(t *testing.T) {
	got := AnrSpikeMessage("Bar.kt", "run", "Input dispatching timed out")
	want := "ANRs are spiking at:\n\nBar.kt: run() - Input dispatching timed out"
	if got != want {
		t.Errorf("AnrSpikeMessage = %q, want %q", got, want)
	}
}

func TestBugReportMessage(t *testing.T) {
	t.Run("carries the description through unchanged", func(t *testing.T) {
		got := BugReportMessage("Login button <b>does nothing</b>")
		want := "A new bug report has been submitted:\n\nLogin button <b>does nothing</b>"
		if got != want {
			t.Errorf("BugReportMessage = %q, want %q", got, want)
		}
	})

	t.Run("replaces an empty description with a placeholder", func(t *testing.T) {
		got := BugReportMessage("")
		want := "A new bug report has been submitted:\n\nNo description provided."
		if got != want {
			t.Errorf("BugReportMessage = %q, want %q", got, want)
		}
	})
}

func TestCrashSpikeURL(t *testing.T) {
	t.Run("appends the file name after the crash type", func(t *testing.T) {
		got := CrashSpikeURL("https://measure.sh", "team-1", "app-1", "fp-1", "java.lang.NullPointerException", "Foo.kt")
		want := "https://measure.sh/team-1/errors/app-1/fp-1/java.lang.NullPointerException@Foo.kt"
		if got != want {
			t.Errorf("CrashSpikeURL = %q, want %q", got, want)
		}
	})

	t.Run("omits the suffix without a file name", func(t *testing.T) {
		got := CrashSpikeURL("https://measure.sh", "team-1", "app-1", "fp-1", "java.lang.NullPointerException", "")
		want := "https://measure.sh/team-1/errors/app-1/fp-1/java.lang.NullPointerException"
		if got != want {
			t.Errorf("CrashSpikeURL = %q, want %q", got, want)
		}
	})
}

func TestAnrSpikeURL(t *testing.T) {
	t.Run("appends the file name after the ANR type", func(t *testing.T) {
		got := AnrSpikeURL("https://measure.sh", "team-1", "app-1", "fp-2", "AnrError", "Bar.kt")
		want := "https://measure.sh/team-1/errors/app-1/fp-2/AnrError@Bar.kt"
		if got != want {
			t.Errorf("AnrSpikeURL = %q, want %q", got, want)
		}
	})

	t.Run("omits the suffix without a file name", func(t *testing.T) {
		got := AnrSpikeURL("https://measure.sh", "team-1", "app-1", "fp-2", "AnrError", "")
		want := "https://measure.sh/team-1/errors/app-1/fp-2/AnrError"
		if got != want {
			t.Errorf("AnrSpikeURL = %q, want %q", got, want)
		}
	})
}

func TestBugReportURL(t *testing.T) {
	got := BugReportURL("https://measure.sh", "team-1", "app-1", "bug-1")
	want := "https://measure.sh/team-1/bug_reports/app-1/bug-1"
	if got != want {
		t.Errorf("BugReportURL = %q, want %q", got, want)
	}
}
