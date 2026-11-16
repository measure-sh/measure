// Package bus provides a backend-agnostic message bus for producing and
// consuming messages. Two implementations are available:
//
//   - Google Cloud Pub/Sub (cloud environments)
//   - Apache Iggy (self-hosted environments)
//
// Both backends expose the same [Producer] and [Consumer] interfaces, so
// callers can switch between them without changing application logic.
//
// # Producing messages
//
// Use [NewPubSubProducer] or [NewIggyProducer] to create a producer.
// [Producer.Publish] blocks until the backend confirms delivery.
//
//	// Pub/Sub
//	p, err := bus.NewPubSubProducer(ctx, "ingest-batch")
//
//	// Iggy
//	p, err := bus.NewIggyProducer(addr, user, pass, name, bus.DefaultStreamName, "ingest-batch")
//
//	// Publish (same for both)
//	err = p.Publish(ctx, payload)
//	defer p.Close()
//
// Iggy producers use balanced (round-robin) partitioning.
//
// # Consuming messages
//
// Use [NewPubSubConsumer] or [NewIggyGroupConsumer] to
// create a consumer. [Consumer.Listen] blocks, calling the handler for each
// message until the context is cancelled or a fatal error occurs.
//
//	// Pub/Sub
//	c, err := bus.NewPubSubConsumer(ctx, "my-subscription",
//	    bus.WithPubSubReceiveSettings(pubsub.ReceiveSettings{MaxOutstandingMessages: 100}),
//	)
//
//	// Iggy (consumer group for load balancing across instances)
//	c, err := bus.NewIggyGroupConsumer(addr, user, pass, "my-group",
//	    bus.DefaultStreamName, "ingest-batch",
//	    bus.WithIggyBatchSize(50),
//	    bus.WithIggyPollInterval(5*time.Second),
//	)
//
//	// Listen (same for both)
//	err = c.Listen(ctx, func(ctx context.Context, data []byte) error {
//	    // Return nil to acknowledge, return error to nack/retry.
//	    return process(ctx, data)
//	})
//	defer c.Close()
//
// # Handler contract
//
// The handler passed to [Consumer.Listen] must process messages synchronously.
// Returning nil signals success and the message is acknowledged. Returning a
// non-nil error signals failure:
//
//   - Pub/Sub: the message is nacked and redelivered by the server.
//   - Iggy: the message offset is not committed; the consumer rewinds to the
//     failed message so it & any remaining messages in the batch are
//     redelivered.
//
// Because Iggy commits offsets only after successful handling, the handler
// must complete all processing before returning. Dispatching work to a
// background goroutine and returning nil will cause premature offset commits
// and potential message loss.
//
// # Error handling and resilience
//
// Both backends handle transient errors internally:
//
//   - Pub/Sub: automatically reconnects after a transient Receive error,
//     waiting 5 seconds between attempts.
//   - Iggy: the reader retries failed reads by itself. The consumer gives up
//     after 5 consecutive whole-reader read errors, which reset after any
//     successful read.
//
// Fatal Iggy read errors, failed seeks, and publish failures other than an
// oversized payload, a cancelled context or an uncertain or lane-blocked
// send wrap [ErrUnrecoverable] and the caller exits the process. Uncertain
// & lane-blocked sends release their lane & return a plain error so the
// caller can retry.
//
// # Iggy consumers
//
// [NewIggyGroupConsumer] joins a named consumer group, enabling multiple
// instances to load-balance partitions. On [Consumer.Close] the consumer
// leaves the group.
//
// # Cleanup
//
// Always call [Consumer.Close] and [Producer.Close] when done. Close releases
// backend connections & Iggy consumers leave their consumer group.
package bus
