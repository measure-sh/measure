package measure

import (
	"context"
	"errors"
	"testing"

	"backend/libs/bus"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func runWithSpan(fn func() error) (sdktrace.ReadOnlySpan, error) {
	rec := tracetest.NewSpanRecorder()
	tp := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(rec))
	_, span := tp.Tracer("test").Start(context.Background(), "work")

	err := func() (err error) {
		defer span.End()
		defer recoverPoison(span, &err)
		return fn()
	}()
	return rec.Ended()[0], err
}

func TestRecoverPoisonPanic(t *testing.T) {
	span, err := runWithSpan(func() error { panic("boom") })

	if !errors.Is(err, bus.ErrPoison) {
		t.Fatalf("err = %v, want poison", err)
	}
	if span.Status().Code != codes.Error {
		t.Errorf("status = %v, want Error", span.Status().Code)
	}
	if !hasStacktrace(span) {
		t.Error("no exception event with exception.stacktrace")
	}
}

func TestRecoverPoisonNoPanic(t *testing.T) {
	plain := errors.New("plain")
	span, err := runWithSpan(func() error { return plain })

	if err != plain {
		t.Errorf("err = %v, want unchanged", err)
	}
	if span.Status().Code != codes.Unset || len(span.Events()) != 0 {
		t.Errorf("span touched: status %v events %v", span.Status(), span.Events())
	}
}

func hasStacktrace(span sdktrace.ReadOnlySpan) bool {
	for _, ev := range span.Events() {
		if ev.Name != "exception" {
			continue
		}
		for _, kv := range ev.Attributes {
			if kv.Key == attribute.Key("exception.stacktrace") && kv.Value.AsString() != "" {
				return true
			}
		}
	}
	return false
}
