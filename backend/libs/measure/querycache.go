package measure

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"backend/libs/filter"

	"github.com/google/uuid"
	valkey "github.com/valkey-io/valkey-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

// queryCache keeps the results of read queries in Valkey for a fixed time. A
// cached result does not include changes from that time. Use it only where a
// result a few minutes old is acceptable.
//
// Each kind of result, such as funnel results, has its own queryCache. The
// name starts each Valkey key and span name of that kind.
type queryCache struct {
	name string
	// Change the version when a cached result type or its query changes.
	// Then the cache does not read entries from the older code.
	version int
}

// cachedQuery returns the cached result for key. On a miss, it runs query
// and caches the result for ttl. If Valkey fails, the error goes to the log
// and query runs without the cache. Thus a Valkey outage makes requests
// slower, but they do not fail.
func cachedQuery[T any](ctx context.Context, vk valkey.Client, cache queryCache, appID uuid.UUID, queryName string, key any, ttl time.Duration, query func() (T, error)) (T, error) {
	if vk == nil {
		return query()
	}
	keyJSON, err := json.Marshal(key)
	if err != nil {
		var zero T
		return zero, err
	}
	sum := sha256.Sum256(keyJSON)
	valkeyKey := fmt.Sprintf("%s:v%d:%s", cache.name, cache.version, hex.EncodeToString(sum[:]))

	readCtx, readSpan := tracer.Start(ctx, cache.name+".cache_read")
	readSpan.SetAttributes(
		attribute.String(cache.name+".app_id", appID.String()),
		attribute.String(cache.name+".query", queryName))
	body, err := vk.Do(readCtx, vk.B().Get().Key(valkeyKey).Build()).AsBytes()
	hit := false
	var result T
	switch {
	case valkey.IsValkeyNil(err):
		err = nil
	case err != nil:
		log.Printf("%s cache: valkey get failed: %v", cache.name, err)
	default:
		if err = json.Unmarshal(body, &result); err != nil {
			log.Printf("%s cache: decode failed: %v", cache.name, err)
			result = *new(T)
		} else {
			hit = true
		}
	}
	readSpan.SetAttributes(attribute.Bool(cache.name+".cache_hit", hit))
	if err != nil {
		readSpan.SetStatus(codes.Error, err.Error())
	}
	readSpan.End()
	if hit {
		return result, nil
	}

	result, err = query()
	if err != nil {
		return result, err
	}
	body, err = json.Marshal(result)
	if err != nil {
		return result, err
	}

	writeCtx, writeSpan := tracer.Start(ctx, cache.name+".cache_write")
	writeSpan.SetAttributes(
		attribute.String(cache.name+".app_id", appID.String()),
		attribute.String(cache.name+".query", queryName),
		attribute.Int(cache.name+".cache_bytes", len(body)),
		attribute.Int64(cache.name+".cache_ttl_seconds", int64(ttl.Seconds())))
	cmd := vk.B().Set().Key(valkeyKey).Value(valkey.BinaryString(body)).ExSeconds(int64(ttl.Seconds())).Build()
	if err := vk.Do(writeCtx, cmd).Error(); err != nil {
		log.Printf("%s cache: valkey set failed: %v", cache.name, err)
		writeSpan.SetStatus(codes.Error, err.Error())
	}
	writeSpan.End()
	return result, nil
}

// SampledPage is one page of a list that a sampled query read. The cache
// keeps the page as one value. SamplePercent is the percent of the app's
// installations in the sample, or nil when the page has no rows.
type SampledPage[T any] struct {
	Results       []T      `json:"results"`
	Next          bool     `json:"next"`
	Previous      bool     `json:"previous"`
	SamplePercent *float64 `json:"sample_percent"`
}

// alignCachedRange rounds down the bounds of a range that ends at the
// current time. Such a range has new bounds on each request. Rounded bounds
// let repeated requests share a cached result. A cached result does not have
// the newest events in any case.
//
// Only bounds from the clock have seconds. A person sets other bounds, such
// as the end of a custom range, on a whole minute. These bounds do not
// change, because a change adds or removes events that the person asked for.
func alignCachedRange(flt *filter.Filter) *filter.Filter {
	step := time.Minute
	if flt.To.Sub(flt.From) >= 24*time.Hour {
		step = 10 * time.Minute
	}
	from, to := alignCachedBound(flt.From, step), alignCachedBound(flt.To, step)
	if !to.After(from) {
		return flt
	}
	alignedFlt := *flt
	alignedFlt.From, alignedFlt.To = from, to
	return &alignedFlt
}

func alignCachedBound(bound time.Time, step time.Duration) time.Time {
	if bound.Truncate(time.Minute).Equal(bound) {
		return bound
	}
	return bound.Truncate(step)
}
