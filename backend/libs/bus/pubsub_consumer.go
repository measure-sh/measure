package bus

import (
	"context"
	"fmt"
	"log"
	"time"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/pubsub/v2"
)

type pubSubConsumer struct {
	// client is the underlying Pub/Sub client.
	client *pubsub.Client
	// subID is the subscription ID (short form or full resource name).
	subID string
	// maxOutstandingMessages caps in-flight messages during Receive.
	maxOutstandingMessages int
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

	return &pubSubConsumer{
		client:                 client,
		subID:                  subscription,
		maxOutstandingMessages: cfg.maxOutstandingMessages,
	}, nil
}

func (c *pubSubConsumer) Listen(ctx context.Context, handler func(ctx context.Context, data []byte) error) error {
	for {
		sub := c.client.Subscriber(c.subID)
		if c.maxOutstandingMessages > 0 {
			sub.ReceiveSettings.MaxOutstandingMessages = c.maxOutstandingMessages
		}
		err := sub.Receive(ctx, func(ctx context.Context, msg *pubsub.Message) {
			if err := handler(ctx, msg.Data); err != nil {
				msg.Nack()
			} else {
				msg.Ack()
			}
		})

		// Context cancelled means a deliberate shutdown — exit cleanly.
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// Transient error (e.g. gRPC connection dropped) — log and reconnect.
		log.Printf("bus: pubsub receive disconnected: %v, reconnecting...", err)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(5 * time.Second):
		}
	}
}

func (c *pubSubConsumer) Close() error {
	return c.client.Close()
}
