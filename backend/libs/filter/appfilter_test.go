package filter

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestAppFilterValidatePlotTimeGroup(t *testing.T) {
	now := time.Now().UTC()

	for _, group := range []string{
		PlotTimeGroupMinutes,
		PlotTimeGroupHours,
		PlotTimeGroupDays,
		PlotTimeGroupMonths,
	} {
		af := AppFilter{
			AppID:         uuid.New(),
			From:          now.Add(-time.Hour),
			To:            now,
			Limit:         1,
			PlotTimeGroup: group,
		}

		if err := af.Validate(); err != nil {
			t.Fatalf("expected plot_time_group=%q to be valid, got %v", group, err)
		}
	}

	af := AppFilter{
		AppID:         uuid.New(),
		From:          now.Add(-time.Hour),
		To:            now,
		Limit:         1,
		PlotTimeGroup: "weeks",
	}

	if err := af.Validate(); err == nil {
		t.Fatalf("expected invalid plot_time_group to fail validation")
	} else if !strings.Contains(err.Error(), "`plot_time_group` must be one of:") {
		t.Fatalf("unexpected validation error: %v", err)
	}
}

func TestHasPlotTimeGroup(t *testing.T) {
	af := AppFilter{}
	if af.HasPlotTimeGroup() {
		t.Fatalf("expected HasPlotTimeGroup=false for empty value")
	}

	af.PlotTimeGroup = PlotTimeGroupHours
	if !af.HasPlotTimeGroup() {
		t.Fatalf("expected HasPlotTimeGroup=true for non-empty value")
	}
}

func TestAppFilterValidatePlotTimeGroupWithOtherFilters(t *testing.T) {
	now := time.Now().UTC()
	af := AppFilter{
		AppID:         uuid.New(),
		From:          now.Add(-24 * time.Hour),
		To:            now,
		Limit:         10,
		PlotTimeGroup: PlotTimeGroupMonths,
		Versions:      []string{"1.0.0"},
		VersionCodes:  []string{"100"},
		OsNames:       []string{"Android"},
		OsVersions:    []string{"14"},
	}
	if err := af.Validate(); err != nil {
		t.Fatalf("expected validation success with mixed filters, got %v", err)
	}

	af.PlotTimeGroup = "invalid_group"
	if err := af.Validate(); err == nil {
		t.Fatalf("expected validation error for invalid plot_time_group with mixed filters")
	}
}
