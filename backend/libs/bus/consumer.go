package bus

import (
	"context"
	"fmt"
	"log"
	"time"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/pubsub/v2"
	iggclient "github.com/apache/iggy/foreign/go/client"
	"github.com/apache/iggy/foreign/go/client/tcp"
	iggcon "github.com/apache/iggy/foreign/go/contracts"
)

type pubSubConsumer struct {
	// client is the underlying Pub/Sub client.
	client *pubsub.Client
	// subID is the subscription ID (short form or full resource name).
	subID string
}

// NewPubSubConsumer creates a Pub/Sub-backed Consumer using a pull subscription.
// subscription is the short subscription ID (or the full resource name).
// If WithPubSubProjectID is not provided, the project ID is auto-detected
// from the GCE metadata server.
func NewPubSubConsumer(ctx context.Context, subscription string, opts ...PubSubOption) (Consumer, error) {
	cfg := &pubSubConfig{}
	for _, o := range opts {
		o(cfg)
	}

	projectID := cfg.projectID
	if projectID == "" {
		id, err := metadata.ProjectIDWithContext(ctx)
		if err != nil {
			return nil, fmt.Errorf("bus: failed to get GCP project ID: %w", err)
		}
		projectID = id
	}

	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("bus: failed to create Pub/Sub client: %w", err)
	}

	return &pubSubConsumer{client: client, subID: subscription}, nil
}

func (c *pubSubConsumer) Listen(ctx context.Context, handler func(ctx context.Context, data []byte) error) error {
	sub := c.client.Subscriber(c.subID)
	return sub.Receive(ctx, func(ctx context.Context, msg *pubsub.Message) {
		if err := handler(ctx, msg.Data); err != nil {
			msg.Nack()
		} else {
			msg.Ack()
		}
	})
}

func (c *pubSubConsumer) Close() error {
	return c.client.Close()
}

type iggyConsumer struct {
	// client is the underlying Iggy client.
	client iggcon.Client
	// streamID identifies the source Iggy stream.
	streamID iggcon.Identifier
	// topicID identifies the source Iggy topic within the stream.
	topicID iggcon.Identifier
	// consumer holds the consumer identity used when polling.
	consumer         iggcon.Consumer
	partitioningKind iggcon.PartitioningKind
	// partID is the partition to poll from.
	partID *uint32
}

// NewIggyConsumer creates an Iggy-backed Consumer.
// address is "host:port"; username and password are required for authentication.
// consumerName identifies this consumer to the Iggy server.
// streamName and topicName identify the source stream/topic.
func NewIggyConsumer(address, username, password, consumerName, streamName, topicName string, opts ...IggyOption) (Consumer, error) {
	cfg := &iggyConfig{}
	for _, o := range opts {
		o(cfg)
	}

	client, err := iggclient.NewIggyClient(iggclient.WithTcp(tcp.WithServerAddress(address)))
	if err != nil {
		return nil, fmt.Errorf("bus: failed to create Iggy client: %w", err)
	}

	if _, err := client.LoginUser(username, password); err != nil {
		return nil, fmt.Errorf("bus: Iggy login failed: %w", err)
	}

	streamID, err := iggcon.NewIdentifier(streamName)
	if err != nil {
		return nil, fmt.Errorf("bus: invalid Iggy stream name: %w", err)
	}
	topicID, err := iggcon.NewIdentifier(topicName)
	if err != nil {
		return nil, fmt.Errorf("bus: invalid Iggy topic name: %w", err)
	}

	consumerID, err := iggcon.NewIdentifier(consumerName)
	if err != nil {
		return nil, fmt.Errorf("bus: invalid Iggy consumer name: %w", err)
	}

	if err := client.JoinConsumerGroup(streamID, topicID, consumerID); err != nil {
		return nil, fmt.Errorf("bus: failed to join Iggy consumer group: %w", err)
	}

	var partID *uint32
	var partitioningKind iggcon.PartitioningKind
	switch cfg.partitioningKind {
	case iggyPartitioningPartitionID:
		id := cfg.partitionID
		partID = &id
	case iggyPartitioningMessageKey:
		// Iggy's PollMessages API routes by partition ID, not by message key.
		// Message keys are a producer-side routing concept; the corresponding
		// consumer should pin to the specific partition that the key resolves to
		// (WithIggyPartitionID). Falling back to balanced (round-robin) here.
		partID = nil
	default:
		// Balanced (round-robin): nil tells the server to distribute polling
		// evenly across all partitions.
		partitioningKind = iggcon.Balanced
	}

	return &iggyConsumer{
		client: client,
		// consumer:         iggcon.NewSingleConsumer(consumerID),
		consumer:         iggcon.NewGroupConsumer(consumerID),
		streamID:         streamID,
		topicID:          topicID,
		partitioningKind: partitioningKind,
		partID:           partID,
	}, nil
}

func (c *iggyConsumer) Listen(ctx context.Context, handler func(ctx context.Context, data []byte) error) error {
	strategy := iggcon.NextPollingStrategy()
	const batchSize = 10
	const pollInterval = 500 * time.Millisecond

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		polled, err := c.client.PollMessages(c.streamID, c.topicID, c.consumer, strategy, batchSize, true, nil)
		if err != nil {
			return fmt.Errorf("bus: Iggy poll failed: %w", err)
		}

		if polled == nil || len(polled.Messages) == 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(pollInterval):
			}
			continue
		}

		for _, msg := range polled.Messages {
			if err := handler(ctx, msg.Payload); err != nil {
				// Iggy doesn't support per-message nack; offset is already
				// committed (autoCommit=true). Log and continue.
				log.Printf("bus: iggy handler error (message not retried): %v", err)
			}
		}
	}
}

func (c *iggyConsumer) Close() error {
	return c.client.Close()
}
