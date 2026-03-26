package bus

import (
	"context"
	"fmt"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/pubsub/v2"
	iggclient "github.com/apache/iggy/foreign/go/client"
	"github.com/apache/iggy/foreign/go/client/tcp"
	iggcon "github.com/apache/iggy/foreign/go/contracts"
)

type pubSubProducer struct {
	// client is the underlying Pub/Sub client used to create the publisher.
	client *pubsub.Client
	// publisher is the topic publisher created from client.
	publisher *pubsub.Publisher
}

// NewPubSubProducer creates a Pub/Sub-backed Producer.
// topic is the short topic ID (e.g. "ingest-batch"); the full resource name
// "projects/{project}/topics/{topic}" is constructed internally.
// If WithPubSubProjectID is not provided, the project ID is auto-detected
// from the GCE metadata server.
func NewPubSubProducer(ctx context.Context, topic string, opts ...PubSubOption) (Producer, error) {
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

	topicName := fmt.Sprintf("projects/%s/topics/%s", projectID, topic)
	publisher := client.Publisher(topicName)
	return &pubSubProducer{client: client, publisher: publisher}, nil
}

func (p *pubSubProducer) Publish(ctx context.Context, data []byte) error {
	result := p.publisher.Publish(ctx, &pubsub.Message{Data: data})
	if _, err := result.Get(ctx); err != nil {
		return fmt.Errorf("bus: pubsub publish failed: %w", err)
	}
	return nil
}

func (p *pubSubProducer) Close() error {
	p.publisher.Stop()
	return p.client.Close()
}

type iggyProducer struct {
	// client is the underlying Iggy client.
	client iggcon.Client
	// streamID identifies the target Iggy stream.
	streamID iggcon.Identifier
	// topicID identifies the target Iggy topic within the stream.
	topicID iggcon.Identifier
	// partitioning is the strategy used to route messages to a partition.
	partitioning iggcon.Partitioning
}

// NewIggyProducer creates an Iggy-backed Producer.
// address is "host:port"; username and password are required for authentication.
// consumerName identifies this producer to the Iggy server.
// streamName and topicName identify the target stream/topic.
// By default, messages are distributed using the balanced (round-robin) partitioning
// scheme. Use WithIggyPartitionID or WithIggyMessageKey to override.
func NewIggyProducer(address, username, password, consumerName, streamName, topicName string, opts ...IggyOption) (Producer, error) {
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

	var partitioning iggcon.Partitioning
	switch cfg.partitioningKind {
	case iggyPartitioningPartitionID:
		partitioning = iggcon.PartitionId(cfg.partitionID)
	case iggyPartitioningMessageKey:
		p, err := iggcon.EntityIdBytes(cfg.messageKey)
		if err != nil {
			return nil, fmt.Errorf("bus: invalid message key: %w", err)
		}
		partitioning = p
	default:
		// iggcon.None() produces a Partitioning with Kind=Balanced, which is
		// the Iggy SDK's name for the balanced (round-robin) scheme. Despite
		// the misleading name, it is not a no-op — it distributes messages
		// evenly across all available partitions.
		partitioning = iggcon.None()
	}

	return &iggyProducer{
		client:       client,
		streamID:     streamID,
		topicID:      topicID,
		partitioning: partitioning,
	}, nil
}

func (p *iggyProducer) Publish(_ context.Context, data []byte) error {
	msg, err := iggcon.NewIggyMessage(data)
	if err != nil {
		return fmt.Errorf("bus: failed to create Iggy message: %w", err)
	}
	if err := p.client.SendMessages(p.streamID, p.topicID, p.partitioning, []iggcon.IggyMessage{msg}); err != nil {
		return fmt.Errorf("bus: Iggy send failed: %w", err)
	}
	return nil
}

func (p *iggyProducer) Close() error {
	return p.client.Close()
}
