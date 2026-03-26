package bus

import (
	"context"
	"fmt"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/pubsub/v2"
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
