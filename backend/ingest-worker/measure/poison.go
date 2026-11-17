package measure

import (
	"errors"
	"fmt"
	"log"
	"runtime/debug"

	"backend/libs/bus"

	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// recoverPoison recovers a panic in the deferred goroutine & stores an error
// wrapping bus.ErrPoison in *err. A non-nil span records the error with its
// stack & gets an Error status. It must be deferred directly.
func recoverPoison(span trace.Span, err *error) {
	r := recover()
	if r == nil {
		return
	}
	perr := fmt.Errorf("%w: panic: %v", bus.ErrPoison, r)
	log.Printf("ingest: recovered panic: %v\n%s", r, debug.Stack())
	*err = perr
	if span == nil {
		return
	}
	span.RecordError(perr, trace.WithStackTrace(true))
	span.SetStatus(codes.Error, perr.Error())
}

// markPoisonSpan sets span to Error status when *err wraps bus.ErrPoison.
func markPoisonSpan(span trace.Span, err *error) {
	if !isPoison(*err) {
		return
	}
	span.SetStatus(codes.Error, (*err).Error())
}

// isPoison reports whether err wraps bus.ErrPoison.
func isPoison(err error) bool {
	return errors.Is(err, bus.ErrPoison)
}
