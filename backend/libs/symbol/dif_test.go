package symbol

import (
	"bytes"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestBuildUnifiedLayout(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "dashed uuid",
			in:   "462e29f0-2ecf-536c-9b52-021ead322b75",
			want: "46/2e29f02ecf536c9b52021ead322b75",
		},
		{
			name: "stripped uuid",
			in:   "462e29f02ecf536c9b52021ead322b75",
			want: "46/2e29f02ecf536c9b52021ead322b75",
		},
		{
			name: "different dashed uuid",
			in:   "95ca68df-f9ef-3380-be56-f7663a87a5b4",
			want: "95/ca68dff9ef3380be56f7663a87a5b4",
		},
		{
			name: "preserves case",
			in:   "ABCDEF01-2345-6789-ABCD-EF0123456789",
			want: "AB/CDEF0123456789ABCDEF0123456789",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := BuildUnifiedLayout(tc.in)
			if got != tc.want {
				t.Errorf("BuildUnifiedLayout(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestFormatUUID(t *testing.T) {
	cases := []struct {
		name string
		in   []byte
		want string
	}{
		{
			name: "all zero bytes",
			in:   make([]byte, 16),
			want: "00000000-0000-0000-0000-000000000000",
		},
		{
			name: "known uuid bytes",
			in: []byte{
				0x46, 0x2e, 0x29, 0xf0,
				0x2e, 0xcf,
				0x53, 0x6c,
				0x9b, 0x52,
				0x02, 0x1e, 0xad, 0x32, 0x2b, 0x75,
			},
			want: "462e29f0-2ecf-536c-9b52-021ead322b75",
		},
		{
			name: "all 0xff bytes",
			in: []byte{
				0xff, 0xff, 0xff, 0xff,
				0xff, 0xff,
				0xff, 0xff,
				0xff, 0xff,
				0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
			},
			want: "ffffffff-ffff-ffff-ffff-ffffffffffff",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := formatUUID(tc.in)
			if got != tc.want {
				t.Errorf("formatUUID(%x) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestMappingKeyToDebugId(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "round-trips with BuildUnifiedLayout",
			in:   "46/2e29f02ecf536c9b52021ead322b75",
			want: "462e29f0-2ecf-536c-9b52-021ead322b75",
		},
		{
			name: "different unified layout key",
			in:   "95/ca68dff9ef3380be56f7663a87a5b4",
			want: "95ca68df-f9ef-3380-be56-f7663a87a5b4",
		},
		{
			name: "preserves case",
			in:   "AB/CDEF0123456789ABCDEF0123456789",
			want: "ABCDEF01-2345-6789-ABCD-EF0123456789",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := MappingKeyToDebugId(tc.in)
			if got != tc.want {
				t.Errorf("MappingKeyToDebugId(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestMappingKeyToCodeId(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "unified layout with debuginfo suffix",
			in:   "46/2e29f02ecf536c9b52021ead322b75/debuginfo",
			want: "462e29f02ecf536c9b52021ead322b75",
		},
		{
			name: "without debuginfo suffix",
			in:   "46/2e29f02ecf536c9b52021ead322b75",
			want: "462e29f02ecf536c9b52021ead322b75",
		},
		{
			name: "strips every slash",
			in:   "ab/cd/ef/debuginfo",
			want: "abcdef",
		},
		{
			name: "strips every debuginfo occurrence",
			in:   "debuginfo/ab/debuginfo",
			want: "ab",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := MappingKeyToCodeId(tc.in)
			if got != tc.want {
				t.Errorf("MappingKeyToCodeId(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestExtractDsymEntities(t *testing.T) {
	dsym, err := os.Open("./test.dsym.tgz")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	debugBytes, err := os.ReadFile("./DemoApp")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	defer dsym.Close()

	{
		got, err := ExtractDsymEntities(dsym, func(name string) (DsymType, bool) {
			parts := strings.Split(name, "/")
			last := ""
			if len(parts) > 0 {
				last = parts[len(parts)-1]
			}
			symbolCondition := strings.Count(name, "Contents/Resources/") == 1 && !strings.HasSuffix(name, ".dSYM") && len(parts) == 5 && !strings.HasPrefix(last, "._")

			if symbolCondition {
				return TypeDsymDebug, true
			}

			return TypeDsymUnknown, false
		})

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		meta := struct {
			Name       string `json:"name"`
			Arch       string `json:"arch"`
			FileFormat string `json:"file_format"`
		}{
			Name:       "DemoApp",
			Arch:       "arm64",
			FileFormat: "macho",
		}

		metaBytes, err := json.Marshal(meta)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expected := [][]*Dif{
			{
				{
					Data: debugBytes,
					Meta: false,
					Key:  "95/ca68dff9ef3380be56f7663a87a5b4/debuginfo",
				},
				{
					Data: metaBytes,
					Meta: true,
					Key:  "95/ca68dff9ef3380be56f7663a87a5b4/meta",
				},
			},
		}

		// assertions for debuginfo
		if len(expected[0][0].Data) != len(got[0][0].Data) {
			t.Errorf("Expected %d length, but got %d", len(expected[0][0].Data), len(got[0][0].Data))
		}

		if !bytes.Equal(expected[0][0].Data, got[0][0].Data) {
			t.Errorf("Expected debuginfo bytes %v, but got %v", expected[0][0].Data, got[0][0].Data)
		}

		if expected[0][0].Meta != got[0][0].Meta {
			t.Errorf("Expected meta %v, but got %v", expected[0][0].Meta, got[0][0].Meta)
		}

		if expected[0][0].Key != got[0][0].Key {
			t.Errorf("Expected debuginfo key %v, but got %v", expected[0][0].Key, got[0][0].Key)
		}

		// assertions for meta file
		if !bytes.Equal(expected[0][1].Data, got[0][1].Data) {
			t.Errorf("Expected meta bytes %v, but got %v", expected[0][1].Data, got[0][1].Data)
		}

		if expected[0][1].Meta != got[0][1].Meta {
			t.Errorf("Expected meta %v, but got %v", expected[0][1].Meta, got[0][1].Meta)
		}

		if expected[0][1].Key != got[0][1].Key {
			t.Errorf("Expected key %v, but got %v", expected[0][1].Key, got[0][1].Key)
		}
	}
}
