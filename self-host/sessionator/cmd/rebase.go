package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// Wall-clock fields that get shifted. Everything else time-like in a payload
// is an uptime or a duration, which stays valid after a shift.
var (
	eventTimePaths = []string{"timestamp", "attribute.session_start_time"}
	spanTimePaths  = []string{"start_time", "end_time", "attributes.session_start_time"}
)

// timeRebaser shifts every wall-clock timestamp in a recording by one fixed
// offset, so a recording made days ago lands in the dashboard as if it
// happened just now. One offset for the whole recording keeps the gaps
// between events and sessions exactly as they were recorded.
type timeRebaser struct {
	offset time.Duration
}

// newTimeRebaser picks the offset that moves the latest timestamp across
// files to now.
func newTimeRebaser(files []string, now time.Time) (*timeRebaser, error) {
	var latest time.Time
	for _, f := range files {
		_, last, err := batchTimeRange(f)
		if err != nil {
			return nil, err
		}
		if last.After(latest) {
			latest = last
		}
	}
	if latest.IsZero() {
		return &timeRebaser{}, nil
	}
	return &timeRebaser{offset: now.Sub(latest)}, nil
}

func (r *timeRebaser) Event(raw *json.RawMessage) error {
	return r.shift(raw, eventTimePaths)
}

func (r *timeRebaser) Span(raw *json.RawMessage) error {
	paths := spanTimePaths
	n := gjson.GetBytes(*raw, "checkpoints.#").Int()
	for i := range n {
		paths = append(paths, fmt.Sprintf("checkpoints.%d.timestamp", i))
	}
	return r.shift(raw, paths)
}

func (r *timeRebaser) shift(raw *json.RawMessage, paths []string) error {
	out := []byte(*raw)
	for _, p := range paths {
		v := gjson.GetBytes(out, p)
		if !v.Exists() || v.Str == "" {
			continue
		}
		t, err := time.Parse(time.RFC3339Nano, v.Str)
		if err != nil {
			return fmt.Errorf("parse %s %q: %w", p, v.Str, err)
		}
		// Zero times mean "not set" and must stay that way.
		if t.IsZero() || t.Year() <= 1970 {
			continue
		}
		shifted := t.Add(r.offset).UTC().Format(time.RFC3339Nano)
		if out, err = sjson.SetBytes(out, p, shifted); err != nil {
			return err
		}
	}
	*raw = out
	return nil
}

// sortByFirstTimestamp orders batch files the way the SDK sent them. A scan
// returns them by request id, which is random.
func sortByFirstTimestamp(files []string) error {
	first := make(map[string]time.Time, len(files))
	for _, f := range files {
		start, _, err := batchTimeRange(f)
		if err != nil {
			return err
		}
		first[f] = start
	}
	sort.SliceStable(files, func(i, j int) bool {
		return first[files[i]].Before(first[files[j]])
	})
	return nil
}

// batchTimeRange returns the earliest and latest wall-clock time in a batch.
func batchTimeRange(file string) (first, last time.Time, err error) {
	content, err := os.ReadFile(file)
	if err != nil {
		return
	}
	see := func(s string) {
		t, perr := time.Parse(time.RFC3339Nano, s)
		if perr != nil || t.Year() <= 1970 {
			return
		}
		if first.IsZero() || t.Before(first) {
			first = t
		}
		if t.After(last) {
			last = t
		}
	}
	for _, e := range gjson.GetBytes(content, "events").Array() {
		see(e.Get("timestamp").Str)
	}
	for _, s := range gjson.GetBytes(content, "spans").Array() {
		see(s.Get("start_time").Str)
		see(s.Get("end_time").Str)
	}
	return
}
