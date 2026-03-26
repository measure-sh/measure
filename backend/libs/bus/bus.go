package bus

import "context"

// Producer publishes messages to a topic/stream.
type Producer interface {
	// Publish sends data to the configured topic/stream. Blocks until the
	// backend confirms delivery or ctx is cancelled.
	Publish(ctx context.Context, data []byte) error
	// Close flushes any pending messages and releases backend resources.
	Close() error
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
}

// WithPubSubProjectID overrides the GCP project ID.
// If not set, the project ID is auto-detected from the GCE metadata server.
func WithPubSubProjectID(projectID string) PubSubOption {
	return func(c *pubSubConfig) {
		c.projectID = projectID
	}
}

// IggyOption configures an Iggy producer or consumer.
type IggyOption func(*iggyConfig)

// iggyPartitioningKind selects the producer partitioning scheme.
type iggyPartitioningKind int

const (
	// iggyPartitioningBalanced distributes messages evenly across partitions (default).
	iggyPartitioningBalanced iggyPartitioningKind = iota
	// iggyPartitioningPartitionID routes all messages to a fixed partition.
	iggyPartitioningPartitionID
	// iggyPartitioningMessageKey routes messages by a message key.
	iggyPartitioningMessageKey
)

type iggyConfig struct {
	// username and password are used for credential-based login by the consumer.
	username string
	password string
	// partitionID is the partition to poll from (consumer) or route to (producer
	// when WithIggyPartitionID is used).
	partitionID uint32
	// consumerName is the consumer identity used when polling (default: "default").
	consumerName string
	// partitioningKind selects the producer partitioning scheme (default: balanced).
	partitioningKind iggyPartitioningKind
	// messageKey is the routing key used when partitioningKind is iggyPartitioningMessageKey.
	messageKey []byte
}

// WithIggyCredentials sets the username and password for Iggy authentication.
// Used by consumers; producers take credentials as required positional parameters.
func WithIggyCredentials(username, password string) IggyOption {
	return func(c *iggyConfig) {
		c.username = username
		c.password = password
	}
}

// WithIggyPartitionID routes all produced messages to the given partition ID.
// For consumers, it sets the partition to poll from.
func WithIggyPartitionID(id uint32) IggyOption {
	return func(c *iggyConfig) {
		c.partitionID = id
		c.partitioningKind = iggyPartitioningPartitionID
	}
}

// WithIggyMessageKey routes produced messages by the given key.
// key must be between 1 and 255 bytes.
func WithIggyMessageKey(key []byte) IggyOption {
	return func(c *iggyConfig) {
		c.messageKey = key
		c.partitioningKind = iggyPartitioningMessageKey
	}
}

// WithIggyConsumerName sets the consumer identity used when polling (default: "default").
func WithIggyConsumerName(name string) IggyOption {
	return func(c *iggyConfig) {
		c.consumerName = name
	}
}
