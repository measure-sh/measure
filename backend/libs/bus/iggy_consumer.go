package bus

import (
	"context"
	"fmt"
	"log"
	"time"

	iggclient "github.com/apache/iggy/foreign/go/client"
	"github.com/apache/iggy/foreign/go/client/tcp"
	iggcon "github.com/apache/iggy/foreign/go/contracts"
)

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
	// batchSize is the number of messages fetched per poll.
	batchSize uint32
	// pollInterval is the delay between polls when no messages are available.
	pollInterval time.Duration
	// pollingStrategy selects how the server determines the next batch of messages.
	pollingStrategy iggcon.PollingStrategy
}

// newIggyConsumer is the shared builder for both NewIggyConsumer and
// NewIggyGroupConsumer. When kind is ConsumerKindGroup the consumer joins the
// named consumer group; otherwise a plain single consumer is created.
func newIggyConsumer(address, username, password, consumerName, streamName, topicName string, kind iggcon.ConsumerKind, opts ...IggyOption) (Consumer, error) {
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

	var consumer iggcon.Consumer
	if kind == iggcon.ConsumerKindGroup {
		if err := client.JoinConsumerGroup(streamID, topicID, consumerID); err != nil {
			return nil, fmt.Errorf("bus: failed to join Iggy consumer group: %w", err)
		}
		consumer = iggcon.NewGroupConsumer(consumerID)
	} else {
		consumer = iggcon.NewSingleConsumer(consumerID)
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

	var batchSize uint32 = 10
	if cfg.batchSize > 0 {
		batchSize = uint32(cfg.batchSize)
	}

	pollInterval := 500 * time.Millisecond
	if cfg.pollInterval > 0 {
		pollInterval = cfg.pollInterval
	}

	pollingStrategy := iggcon.NextPollingStrategy()
	if cfg.pollingStrategy != nil {
		pollingStrategy = *cfg.pollingStrategy
	}

	return &iggyConsumer{
		client:           client,
		consumer:         consumer,
		streamID:         streamID,
		topicID:          topicID,
		partitioningKind: partitioningKind,
		partID:           partID,
		batchSize:        batchSize,
		pollInterval:     pollInterval,
		pollingStrategy:  pollingStrategy,
	}, nil
}

// NewIggyConsumer creates an Iggy-backed Consumer.
// address is "host:port"; username and password are required for authentication.
// consumerName identifies this consumer to the Iggy server.
// streamName and topicName identify the source stream/topic.
func NewIggyConsumer(address, username, password, consumerName, streamName, topicName string, opts ...IggyOption) (Consumer, error) {
	return newIggyConsumer(address, username, password, consumerName, streamName, topicName, iggcon.ConsumerKindSingle, opts...)
}

// NewIggyGroupConsumer creates an Iggy-backed Consumer that always joins a
// consumer group. consumerName is used as both the consumer identity and the
// group name; streamName and topicName identify the source stream/topic.
func NewIggyGroupConsumer(address, username, password, consumerName, streamName, topicName string, opts ...IggyOption) (Consumer, error) {
	return newIggyConsumer(address, username, password, consumerName, streamName, topicName, iggcon.ConsumerKindGroup, opts...)
}

func (c *iggyConsumer) Listen(ctx context.Context, handler func(ctx context.Context, data []byte) error) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		polled, err := c.client.PollMessages(c.streamID, c.topicID, c.consumer, c.pollingStrategy, c.batchSize, true, nil)
		if err != nil {
			return fmt.Errorf("bus: Iggy poll failed: %w", err)
		}

		if polled == nil || len(polled.Messages) == 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(c.pollInterval):
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
	if c.consumer.Kind == iggcon.ConsumerKindGroup {
		if err := c.client.LeaveConsumerGroup(c.streamID, c.topicID, c.consumer.Id); err != nil {
			log.Printf("bus: failed to leave iggy consumer group: %v", err)
		}
		log.Printf("bus: leaving iggy consumer group\n")
	}

	log.Printf("bus: closing iggy consumer client\n")
	return c.client.Close()
}
