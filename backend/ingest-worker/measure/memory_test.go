//go:build integration

package measure

import (
	"encoding/json"
	"testing"
	"time"

	"backend/ingest-worker/server"
	"backend/libs/event"
	appmeasure "backend/libs/measure"
	"backend/libs/opsys"
	"backend/libs/timeline"

	"github.com/google/uuid"
)

func TestMemoryHeadroomRoundTrip(t *testing.T) {
	ctx := t.Context()
	defer cleanupAll(ctx, t)
	tests := []struct {
		name         string
		payload      string
		wantHeadroom string // Empty means the field must be omitted from JSON.
	}{
		{
			name:    "missing",
			payload: `{"max_memory":8192,"used_memory":3072,"interval":5000}`,
		},
		{
			name:         "exhausted",
			payload:      `{"max_memory":8192,"used_memory":3072,"interval":5000,"available_memory":0}`,
			wantHeadroom: "0",
		},
		{
			name:         "available",
			payload:      `{"max_memory":8192,"used_memory":3072,"interval":5000,"available_memory":1024}`,
			wantHeadroom: "1024",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			appID, teamID, sessionID := uuid.New(), uuid.New(), uuid.New()
			app := appmeasure.App{ID: &appID, TeamId: teamID, OSNames: []string{opsys.IOS}}
			timestamp := time.Date(2026, 9, 17, 0, 0, 0, 0, time.UTC)
			var memory event.MemoryUsageAbs
			if err := json.Unmarshal([]byte(tt.payload), &memory); err != nil {
				t.Fatalf("decode SDK payload: %v", err)
			}
			req := eventreq{
				appId: appID, teamId: teamID, osName: opsys.IOS,
				events: []event.EventField{{
					ID: uuid.New(), AppID: appID, SessionID: sessionID,
					Timestamp: timestamp, Type: event.TypeMemoryUsageAbs,
					MemoryUsageAbs: &memory,
					Attribute: event.Attribute{
						AppVersion: "1.0", AppBuild: "1", OSName: opsys.IOS, OSVersion: "18",
						SessionStartTime: timestamp,
					},
				}},
			}

			// Match the serialization boundary between the ingest service and worker.
			queued, err := json.Marshal(IngestBatch{Events: req.events})
			if err != nil {
				t.Fatalf("serialize ingest batch: %v", err)
			}
			var batch IngestBatch
			if err := json.Unmarshal(queued, &batch); err != nil {
				t.Fatalf("deserialize ingest batch: %v", err)
			}
			req.events = batch.Events
			if err := req.ingestEvents(ctx); err != nil {
				t.Fatalf("ingest events: %v", err)
			}

			session, err := app.GetSessionEvents(ctx, server.Server.ChPool, sessionID)
			if err != nil {
				t.Fatalf("read session events: %v", err)
			}
			samples := timeline.ComputeMemoryUsageAbs(session.EventsOfType(event.TypeMemoryUsageAbs))
			if len(samples) != 1 {
				t.Fatalf("got %d samples, want 1", len(samples))
			}
			body, err := json.Marshal(samples[0])
			if err != nil {
				t.Fatalf("serialize timeline sample: %v", err)
			}
			var response map[string]json.RawMessage
			if err := json.Unmarshal(body, &response); err != nil {
				t.Fatalf("decode timeline response: %v", err)
			}
			if got := string(response["available_memory"]); got != tt.wantHeadroom {
				t.Errorf("available_memory = %q, want %q", got, tt.wantHeadroom)
			}
		})
	}
}
