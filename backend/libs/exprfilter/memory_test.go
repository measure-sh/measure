package exprfilter

import (
	"strings"
	"testing"
)

func TestMemoryEntityOffersEveryMemoryKey(t *testing.T) {
	byName := IndexKeysByName(MemoryEntity.Keys)

	wanted := []string{
		"version_name", "version_code", "patch_version", "patch_id",
		"os_name", "os_version",
		"device_name", "device_manufacturer", "session_ram_tier", "locale",
		"network_type", "network_generation", "network_provider",
		"country",
	}
	for _, name := range wanted {
		if _, ok := byName[name]; !ok {
			t.Errorf("want a %q key on the memory entity", name)
		}
	}
	if len(MemoryEntity.Keys) != len(wanted) {
		t.Errorf("want %d memory keys, got %d", len(wanted), len(MemoryEntity.Keys))
	}
}

func TestMemoryBindKeyRefusesAKeyTheEntityDoesNotHave(t *testing.T) {
	_, err := MemoryEntity.BindKey(Condition{
		KeyName:  "session_foreground_background",
		Operator: OperatorIn,
		Values:   []Value{{Text: "foreground"}},
	})

	if err == nil {
		t.Fatal("want a key the memory entity does not have refused")
	}
	if !strings.Contains(err.Error(), "session_foreground_background") {
		t.Errorf("want the key named, got %q", err)
	}
}

func TestMemoryRAMTierBindsOntoTheAttributeColumn(t *testing.T) {
	stmt, err := MemoryEntity.BindKey(Condition{
		KeyName:  "session_ram_tier",
		Operator: OperatorIn,
		Values:   []Value{{Text: "8gb"}},
	})
	if err != nil {
		t.Fatalf("bind ram tier: %v", err)
	}
	defer stmt.Close()

	want := "(`attribute.device_total_memory_kb` >= 6963200 and `attribute.device_total_memory_kb` < 9437184)"
	if got := stmt.String(); got != want {
		t.Errorf("\n got %s\nwant %s", got, want)
	}
}

func TestMemoryVersionNameIsAPlainColumnNotATuple(t *testing.T) {
	stmt, err := MemoryEntity.BindKey(Condition{
		KeyName:  "version_name",
		Operator: OperatorIn,
		Values:   []Value{{Text: "1.2.0"}},
	})
	if err != nil {
		t.Fatalf("bind version_name: %v", err)
	}
	defer stmt.Close()

	if got := stmt.String(); !strings.Contains(got, "`attribute.app_version`") {
		t.Errorf("want the plain attribute.app_version column, got %s", got)
	}
	if strings.Contains(stmt.String(), "tupleElement") {
		t.Errorf("want no tupleElement unpacking for events, got %s", stmt.String())
	}
}
