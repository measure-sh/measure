package symbol

import (
	"bytes"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestBuildUnifiedLayout(t *testing.T) {
	{
		expected := "46/2e29f02ecf536c9b52021ead322b75"
		got := BuildUnifiedLayout("462e29f0-2ecf-536c-9b52-021ead322b75")
		if expected != got {
			t.Errorf("Expected %s, but got %s", expected, got)
		}
	}
	{
		expected := "46/2e29f02ecf536c9b52021ead322b75"
		got := BuildUnifiedLayout("462e29f02ecf536c9b52021ead322b75")
		if expected != got {
			t.Errorf("Expected %s, but got %s", expected, got)
		}
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
