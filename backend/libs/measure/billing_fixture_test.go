package measure

import (
	"encoding/json"
	"os"
	"testing"

	"backend/libs/autumn"
)

// customerFixture is shared with the autumn package's decode test so the two
// break together.
const customerFixture = "../autumn/testdata/customer_get_response.json"

// TestPlanAndRetentionFromCapturedCustomer runs both billing decisions over a
// decoded response rather than a hand-built customer. The free plan and the
// bespoke plan arrive in separate arrays, so DeterminePlan reaches enterprise
// only if both decoded, and the retention grants pool to 60, so
// RetentionDaysFromBalance reaches 30 only if the breakdown decoded. It lives
// here because measure imports autumn.
func TestPlanAndRetentionFromCapturedCustomer(t *testing.T) {
	raw, err := os.ReadFile(customerFixture)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var cust autumn.Customer
	if err := json.Unmarshal(raw, &cust); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}

	if got := DeterminePlan(&cust); got != PlanEnterprise {
		t.Errorf("DeterminePlan = %q, want %q", got, PlanEnterprise)
	}

	retention, ok := cust.Balances[autumn.FeatureRetentionDays]
	if !ok {
		t.Fatalf("no %s balance, got %v", autumn.FeatureRetentionDays, cust.Balances)
	}
	if got := RetentionDaysFromBalance(retention); got != 30 {
		t.Errorf("RetentionDaysFromBalance = %d, want 30", got)
	}
}
