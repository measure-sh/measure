package measure

import "testing"

func TestCreateDefaultConfigMinLogSeverityNumber(t *testing.T) {
	if got := createDefaultConfig().MinLogSeverityNumber; got != 12 {
		t.Errorf("expected default min log severity number 12, got %d", got)
	}
}
