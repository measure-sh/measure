package filter

import (
	"context"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("filter")

// startReadSpan opens the span for one key or value read on behalf of an app.
func startReadSpan(ctx context.Context, name, table string, teamID, appID uuid.UUID, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	ctx, span := tracer.Start(ctx, name)
	span.SetAttributes(
		attribute.String("filter.table", table),
		attribute.String("filter.team_id", teamID.String()),
		attribute.String("filter.app_id", appID.String()),
	)
	span.SetAttributes(attrs...)
	return ctx, span
}

// endReadSpan closes a read span with either the error or what the read
// returned.
func endReadSpan(span trace.Span, err error, results ...attribute.KeyValue) {
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
	} else {
		span.SetAttributes(results...)
	}
	span.End()
}
