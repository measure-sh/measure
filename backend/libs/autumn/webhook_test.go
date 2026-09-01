package autumn

import (
	"encoding/json"
	"testing"
)

// TestPlanChangePlanID covers both snapshots a plan change can carry: a
// recurring plan arrives under "subscription", a one-off plan under
// "purchase", and the plan id has to come out of whichever one Autumn sent.
func TestPlanChangePlanID(t *testing.T) {
	tests := []struct {
		name    string
		payload string
		want    string
	}{
		{
			name:    "subscription snapshot",
			payload: `{"action":"activated","subscription":{"plan_id":"measure_pro"}}`,
			want:    "measure_pro",
		},
		{
			name:    "purchase snapshot",
			payload: `{"action":"activated","purchase":{"plan_id":"acme_one_year","status":"active","expires_at":1790000000000}}`,
			want:    "acme_one_year",
		},
		{
			name:    "neither snapshot",
			payload: `{"action":"updated"}`,
			want:    "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var pc PlanChange
			if err := json.Unmarshal([]byte(tt.payload), &pc); err != nil {
				t.Fatalf("unmarshal plan change: %v", err)
			}
			if got := pc.PlanID(); got != tt.want {
				t.Errorf("PlanID() = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestPlanChangePurchaseFields verifies the purchase snapshot's own fields
// decode, since the webhook sends a status that the API's Purchase does not.
func TestPlanChangePurchaseFields(t *testing.T) {
	var pc PlanChange
	payload := `{"action":"activated","purchase":{"plan_id":"acme_one_year","status":"active","expires_at":1790000000000}}`
	if err := json.Unmarshal([]byte(payload), &pc); err != nil {
		t.Fatalf("unmarshal plan change: %v", err)
	}
	if pc.Purchase.Status != "active" {
		t.Errorf("Purchase.Status = %q, want %q", pc.Purchase.Status, "active")
	}
	if pc.Purchase.ExpiresAt != 1790000000000 {
		t.Errorf("Purchase.ExpiresAt = %d, want %d", pc.Purchase.ExpiresAt, int64(1790000000000))
	}
	if pc.Subscription.PlanID != "" {
		t.Errorf("Subscription.PlanID = %q, want empty for a one-off change", pc.Subscription.PlanID)
	}
}
