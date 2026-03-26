package bus

import (
	"context"
	"fmt"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/pubsub/v2"
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
