package bus

import (
	"context"
	"errors"
	"time"

	"cloud.google.com/go/pubsub/v2"
	ierror "github.com/apache/iggy/foreign/go/errors"
)

// DefaultStreamName is the global stream for all message streaming operations.
const DefaultStreamName = "measure"

// Producer publishes messages to a topic/stream.
type Producer interface {
	// Publish sends data to the configured topic/stream. Blocks until the
	// backend confirms delivery or ctx is cancelled.
	Publish(ctx context.Context, data []byte) error
	// PublishOrdered sends data like Publish, additionally asking the backend
	// to deliver messages sharing an orderingKey one at a time, in publish
	// order. On Pub/Sub the guarantee also needs the subscription created
	// with message ordering enabled; a subscription without it accepts the
	// key but delivers unordered. Iggy delivers to its consumers serially
	// already, so there the key is ignored.
	PublishOrdered(ctx context.Context, orderingKey string, data []byte) error
	// Close flushes any pending messages and releases backend resources.
	Close() error
}

// ErrUnrecoverable marks an error after which the producer or consumer should
// not be used again, so the process should exit and let its container come
// back with a fresh client. Iggy wraps it when the reader fails permanently
// or a seek fails & on a send failure other than an oversized payload, a
// cancelled context or an uncertain or lane-blocked send. Pub/Sub reconnects
// on its own and never returns it.
var ErrUnrecoverable = errors.New("bus: connection is unrecoverable")

// IsOversized reports whether a Publish error means the payload exceeded the
// backend per-message limit. Permanent, the same payload always fails, so
// callers should reject it rather than retry. Both backends cap at 10,000,000
// bytes but report it with their own error, so the taxonomy lives here rather
// than leaking a transport sentinel into callers.
func IsOversized(err error) bool {
	return errors.Is(err, pubsub.ErrOversizedMessage) ||
		errors.Is(err, ierror.ErrTooBigMessagePayload)
}

// Consumer receives messages from a topic/stream.
type Consumer interface {
	// Listen blocks until ctx is cancelled or a fatal error occurs.
	// handler is called for each received message; returning a non-nil error
	// causes a nack/retry (behaviour is backend-specific).
	Listen(ctx context.Context, handler func(ctx context.Context, data []byte) error) error
	// Close releases backend resources held by the consumer.
	Close() error
}

// PubSubOption configures a Pub/Sub producer or consumer.
type PubSubOption func(*pubSubConfig)

type pubSubConfig struct {
	// projectID is the GCP project ID. Empty means auto-detect from the metadata server.
	projectID string
	// publishSettings mutates publish behaviour (producer-only).
	// If nil, pubsub.DefaultPublishSettings is used unchanged.
	publishSettings func(*pubsub.PublishSettings)
	// receiveSettings configures receive behaviour (consumer-only).
	// If nil, the subscriber's default settings are used.
	receiveSettings *pubsub.ReceiveSettings
}

// WithPubSubProjectID overrides the GCP project ID.
// If not set, the project ID is auto-detected from the GCE metadata server.
func WithPubSubProjectID(projectID string) PubSubOption {
	return func(c *pubSubConfig) {
		c.projectID = projectID
	}
}

// WithReceiveSettings sets the ReceiveSettings for the Pub/Sub consumer.
// If not provided, the subscriber's default settings are used.
// To cap outstanding messages, set ReceiveSettings.MaxOutstandingMessages.
func WithPubSubReceiveSettings(s pubsub.ReceiveSettings) PubSubOption {
	return func(c *pubSubConfig) {
		c.receiveSettings = &s
	}
}

// WithPubSubPublishSettings mutates pubsub.DefaultPublishSettings for the
// producer. It takes a mutator rather than a struct because a struct literal
// cannot express "leave this field alone", so every field the caller omitted
// would silently be zeroed.
func WithPubSubPublishSettings(fn func(*pubsub.PublishSettings)) PubSubOption {
	return func(c *pubSubConfig) {
		c.publishSettings = fn
	}
}

// IggyOption configures an Iggy producer or consumer.
type IggyOption func(*iggyConfig)

type iggyConfig struct {
	// batchSize is the number of messages to fetch per poll (consumer-only).
	batchSize int
	// pollInterval is the server wait per poll & the pause before a failed
	// batch is redelivered (consumer-only).
	pollInterval time.Duration
	// processingConcurrency is the maximum number of messages whose handlers
	// may run concurrently within one batch.
	// A value less than 1 falls back to 1.
	processingConcurrency int
}

// batchSizeOrDefault returns the configured batch size or 500.
func (c *iggyConfig) batchSizeOrDefault() uint32 {
	if c.batchSize <= 0 {
		return 500
	}
	return uint32(c.batchSize)
}

// pollIntervalOrDefault returns the configured poll interval or 500ms.
func (c *iggyConfig) pollIntervalOrDefault() time.Duration {
	if c.pollInterval <= 0 {
		return 500 * time.Millisecond
	}
	return c.pollInterval
}

// processingConcurrencyOrDefault returns the configured concurrency or 1.
func (c *iggyConfig) processingConcurrencyOrDefault() int {
	if c.processingConcurrency <= 0 {
		return 1
	}
	return c.processingConcurrency
}

// WithIggyBatchSize sets the number of messages fetched per poll (default: 500).
func WithIggyBatchSize(n int) IggyOption {
	return func(c *iggyConfig) {
		c.batchSize = n
	}
}

// WithIggyPollInterval sets the server wait per poll & the pause before a
// failed batch is redelivered (default: 500ms).
func WithIggyPollInterval(d time.Duration) IggyOption {
	return func(c *iggyConfig) {
		c.pollInterval = d
	}
}

// WithIggyProcessingConcurrency sets the maximum number of Iggy messages
// processed concurrently inside a single consumer.
//
// The default is 1, which preserves the original serial processing behavior.
func WithIggyProcessingConcurrency(concurrency int) IggyOption {
	return func(c *iggyConfig) {
		if concurrency > 0 {
			c.processingConcurrency = concurrency
		}
	}
}
