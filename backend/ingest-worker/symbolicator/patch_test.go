package symbolicator

import (
	"testing"

	"backend/libs/event"

	"github.com/google/uuid"
)

func TestUsesPatchMappings(t *testing.T) {
	patchID := uuid.New()
	exception := func(framework string) event.EventField {
		return event.EventField{
			Type:      event.TypeException,
			Exception: &event.Exception{Framework: framework},
		}
	}

	if !usesPatchMappings(exception(event.FrameworkJS), patchID) {
		t.Error("expected a js exception to use the patch mappings")
	}
	if usesPatchMappings(exception(event.FrameworkNDK), patchID) {
		t.Error("expected a native crash to use the version mappings")
	}
	if usesPatchMappings(exception(event.FrameworkJS), uuid.Nil) {
		t.Error("expected no patch mappings without a patch_id")
	}
}
