package event

import (
	"testing"
)

func TestNormalizeAddress(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "spaces",
			input:    "   ",
			expected: "",
		},
		{
			name:     "already normalized",
			input:    "0x123abc",
			expected: "0x123abc",
		},
		{
			name:     "uppercase prefix",
			input:    "0X123abc",
			expected: "0x123abc",
		},
		{
			name:     "uppercase hex with prefix",
			input:    "0x123ABC",
			expected: "0x123abc",
		},
		{
			name:     "16 char hex string without prefix",
			input:    "0123456789abcdef",
			expected: "0x0123456789abcdef",
		},
		{
			name:     "16 char uppercase hex string without prefix",
			input:    "0123456789ABCDEF",
			expected: "0x0123456789abcdef",
		},
		{
			name:     "15 char string",
			input:    "123456789abcdef",
			expected: "123456789abcdef",
		},
		{
			name:     "non-hex 16 char string",
			input:    "0123456789abcdex",
			expected: "0123456789abcdex",
		},
		{
			name:     "random string",
			input:    "some_string",
			expected: "some_string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeAddress(tt.input)
			if result != tt.expected {
				t.Errorf("normalizeAddress(%q) = %q; want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestIsHexString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{
			name:     "empty string",
			input:    "",
			expected: true,
		},
		{
			name:     "valid lowercase hex",
			input:    "0123456789abcdef",
			expected: true,
		},
		{
			name:     "valid uppercase hex",
			input:    "0123456789ABCDEF",
			expected: true,
		},
		{
			name:     "mixed case hex",
			input:    "0123456789AbCdEf",
			expected: true,
		},
		{
			name:     "invalid character 'x'",
			input:    "01234x",
			expected: false,
		},
		{
			name:     "invalid character 'g'",
			input:    "abcdefg",
			expected: false,
		},
		{
			name:     "spaces included",
			input:    "12 34",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isHexString(tt.input)
			if result != tt.expected {
				t.Errorf("isHexString(%q) = %v; want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestInAnyPackage(t *testing.T) {
	tests := []struct {
		name      string
		className string
		packages  []string
		expected  bool
	}{
		{
			name:      "class in the package",
			className: "sh.frankenstein.android.AnrJobService",
			packages:  []string{"sh.frankenstein.android"},
			expected:  true,
		},
		{
			name:      "class in a subpackage",
			className: "sh.frankenstein.android.ui.home.HomeScreen",
			packages:  []string{"sh.frankenstein.android"},
			expected:  true,
		},
		{
			name:      "platform class",
			className: "android.os.Handler",
			packages:  []string{"sh.frankenstein.android"},
			expected:  false,
		},
		{
			name:      "package boundary is respected",
			className: "com.ubercab.RideRequest",
			packages:  []string{"com.uber"},
			expected:  false,
		},
		{
			name:      "trailing dot in the package",
			className: "com.uber.RideRequest",
			packages:  []string{"com.uber."},
			expected:  true,
		},
		{
			name:      "class named exactly like the package",
			className: "com.uber",
			packages:  []string{"com.uber"},
			expected:  true,
		},
		{
			name:      "matches any one of several packages",
			className: "com.foo.core.Cache",
			packages:  []string{"com.foo.app", "com.foo.core"},
			expected:  true,
		},
		{
			name:      "no packages configured",
			className: "com.foo.app.Main",
			packages:  nil,
			expected:  false,
		},
		{
			name:      "empty package matches nothing",
			className: "com.foo.app.Main",
			packages:  []string{""},
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := inAnyPackage(tt.className, tt.packages)
			if result != tt.expected {
				t.Errorf("inAnyPackage(%q, %v) = %v; want %v", tt.className, tt.packages, result, tt.expected)
			}
		})
	}
}

func TestFramesMarkInApp(t *testing.T) {
	frames := Frames{
		{ClassName: "java.lang.Thread", MethodName: "sleep"},
		{ClassName: "sh.frankenstein.android.AnrJobService", MethodName: "onStartJob"},
		{ClassName: "android.os.Handler", MethodName: "dispatchMessage"},
	}

	frames.MarkInApp([]string{"sh.frankenstein.android"})

	expected := []bool{false, true, false}
	for i := range frames {
		if frames[i].InApp != expected[i] {
			t.Errorf("frame %d (%s) InApp = %v; want %v", i, frames[i].ClassName, frames[i].InApp, expected[i])
		}
	}
}

func TestIsPlatform(t *testing.T) {
	tests := []struct {
		name      string
		className string
		expected  bool
	}{
		{
			name:      "framework class",
			className: "android.os.Handler",
			expected:  true,
		},
		{
			name:      "language runtime class",
			className: "java.lang.Thread",
			expected:  true,
		},
		{
			name:      "kotlin runtime class",
			className: "kotlinx.coroutines.BlockingCoroutine",
			expected:  true,
		},
		{
			name:      "measure sdk class",
			className: "sh.measure.android.anr.AnrError",
			expected:  true,
		},
		{
			name:      "app class",
			className: "sh.frankenstein.android.AnrJobService",
			expected:  false,
		},
		{
			name:      "third party library class",
			className: "okhttp3.internal.http2.Http2Stream",
			expected:  false,
		},
		{
			name:      "class outside any platform package sharing a prefix",
			className: "javaxin.tools.Compiler",
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isPlatform(tt.className)
			if result != tt.expected {
				t.Errorf("isPlatform(%q) = %v; want %v", tt.className, result, tt.expected)
			}
		})
	}
}
