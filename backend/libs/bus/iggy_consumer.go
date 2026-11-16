package bus

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/apache/iggy/foreign/go/client/reader"
	iggcon "github.com/apache/iggy/foreign/go/contracts"
	ierror "github.com/apache/iggy/foreign/go/errors"
)

const (
	// maxReadFailures is the number of consecutive whole-reader read errors
	// after which Listen gives up.
	maxReadFailures = 5
	// iggyPollMaxBytes caps the reply body of one poll.
	iggyPollMaxBytes = 16 * 1024 * 1024
	// iggyCommitTimeout bounds one offset commit.
	iggyCommitTimeout = 10 * time.Second
	// iggyCloseTimeout bounds the reader close.
	iggyCloseTimeout = 10 * time.Second
)

// batchSource is the part of *reader.PartitionReader the consumer uses.
type batchSource interface {
	Next(ctx context.Context) (*iggcon.PolledMessage, error)
	Commit(ctx context.Context, checkpoint iggcon.Checkpoint) error
	Seek(ctx context.Context, partitionID uint32, start iggcon.PollingStrategy) error
	Close(ctx context.Context) error
}

type iggyConsumer struct {
	// client is the underlying Iggy client.
	client iggcon.Client
	// src delivers batches & stores offsets.
	src batchSource
	// pollInterval is the server wait per poll & the pause before a failed
	// batch is redelivered.
	pollInterval time.Duration
	// processingConcurrency limits the number of message handlers running
	// concurrently inside this consumer.
	processingConcurrency int
}

// NewIggyGroupConsumer creates an Iggy-backed Consumer that reads as a member
// of a consumer group. consumerName is used as both the consumer identity and
// the group name; streamName and topicName identify the source stream/topic.
func NewIggyGroupConsumer(address, username, password, consumerName, streamName, topicName string, opts ...IggyOption) (consumer Consumer, err error) {
	cfg := &iggyConfig{}
	for _, o := range opts {
		o(cfg)
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

	client, err := newIggyClient(address, username, password)
	if err != nil {
		return nil, err
	}

	batchSize, pollInterval := cfg.batchSizeOrDefault(), cfg.pollIntervalOrDefault()
	src, err := reader.NewPartitionReader(
		context.Background(), client, streamID, topicID, iggcon.NewGroupConsumer(consumerID),
		reader.WithPollOptions(pollOptions(batchSize, pollInterval)),
		reader.WithPrefetchMessages(batchSize),
	)
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("bus: failed to start Iggy reader: %w", err)
	}

	return &iggyConsumer{
		client:                client,
		src:                   src,
		pollInterval:          pollInterval,
		processingConcurrency: cfg.processingConcurrencyOrDefault(),
	}, nil
}

// pollOptions returns manual-commit poll options for the given batch size &
// server wait.
func pollOptions(batchSize uint32, wait time.Duration) iggcon.PollOptions {
	opts := iggcon.WaitPollOptions(wait)
	opts.Count = batchSize
	opts.MaxBytes = iggyPollMaxBytes
	return opts
}

// processMessages runs handlers over messages in bounded concurrent windows
// & returns the length of the successful contiguous prefix. Processing stops
// after the first window containing a failure.
func (c *iggyConsumer) processMessages(
	ctx context.Context,
	messages []iggcon.IggyMessage,
	handler func(context.Context, []byte) error,
) (done int) {
	concurrency := max(c.processingConcurrency, 1)

	for start := 0; start < len(messages); start += concurrency {
		end := min(start+concurrency, len(messages))
		results := make([]error, end-start)

		var wg sync.WaitGroup
		wg.Add(end - start)
		for i := start; i < end; i++ {
			go func(slot int, payload []byte) {
				defer wg.Done()
				results[slot] = handler(ctx, payload)
			}(i-start, messages[i].Payload)
		}
		wg.Wait()

		for slot, handlerErr := range results {
			if handlerErr == nil {
				done++
				continue
			}
			log.Printf("bus: iggy handler error (offset %d will be retried): %v", messages[start+slot].Header.Offset, handlerErr)
			return done
		}
	}

	return done
}

// commitPrefix stores the offset of the last of the first n messages using a
// context that survives cancellation of ctx.
func (c *iggyConsumer) commitPrefix(ctx context.Context, batch *iggcon.PolledMessage, n int) error {
	checkpoint, ok := batch.CheckpointAt(n - 1)
	if !ok {
		return fmt.Errorf("bus: no checkpoint at index %d", n-1)
	}
	commitCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), iggyCommitTimeout)
	defer cancel()
	return c.src.Commit(commitCtx, checkpoint)
}

// redeliverFrom rewinds the partition of batch to the message at index so the
// reader delivers it again. A partition that moved away is skipped. Any other
// failure wraps ErrUnrecoverable.
func (c *iggyConsumer) redeliverFrom(ctx context.Context, batch *iggcon.PolledMessage, index int) error {
	offset := batch.Messages[index].Header.Offset
	start := iggcon.OffsetPollingStrategy(offset).WithContext(batch.Context)

	err := c.src.Seek(ctx, batch.PartitionId, start)
	if err == nil {
		return nil
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if errors.Is(err, ierror.ErrInvalidCommand) {
		log.Printf("bus: iggy partition %d no longer owned, offset %d left to its new owner: %v", batch.PartitionId, offset, err)
		return nil
	}
	return fmt.Errorf("bus: Iggy seek to offset %d failed: %w: %w", offset, ErrUnrecoverable, err)
}

// handleBatch processes one batch, commits the successful prefix & rewinds to
// the first failed message. Commit happens before Seek because a Seek resets
// the reader state that a later Commit depends on.
func (c *iggyConsumer) handleBatch(ctx context.Context, batch *iggcon.PolledMessage, handler func(context.Context, []byte) error) error {
	done := c.processMessages(ctx, batch.Messages, handler)

	if done > 0 {
		if err := c.commitPrefix(ctx, batch, done); err != nil {
			log.Printf("bus: iggy offset commit failed (batch will be retried): %v", err)
			done = 0
		}
	}
	if done == len(batch.Messages) {
		return nil
	}

	if err := c.redeliverFrom(ctx, batch, done); err != nil {
		return err
	}
	return sleepCtx(ctx, c.pollInterval)
}

// sleepCtx waits for d or until ctx is done.
func sleepCtx(ctx context.Context, d time.Duration) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(d):
		return nil
	}
}

// handleReadError decides what a Next error means. It returns nil when
// Listen should continue.
func handleReadError(ctx context.Context, err error, failures *int) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}

	var readErr *reader.ReadError
	if !errors.As(err, &readErr) {
		return fmt.Errorf("bus: Iggy read failed: %w: %w", ErrUnrecoverable, err)
	}

	if readErr.PartitionID != nil {
		if errors.Is(err, ierror.ErrConsumerGroupPartitionNotOwned) {
			log.Printf("bus: iggy partition %d not owned, continuing: %v", *readErr.PartitionID, err)
			return nil
		}
		return fmt.Errorf("bus: Iggy partition %d read failed: %w: %w", *readErr.PartitionID, ErrUnrecoverable, err)
	}

	*failures++
	if *failures >= maxReadFailures {
		return fmt.Errorf("bus: Iggy read failed after %d consecutive attempts: %w: %w", *failures, ErrUnrecoverable, err)
	}
	log.Printf("bus: iggy read error (%d/%d): %v", *failures, maxReadFailures, err)
	return nil
}

// Listen delivers each batch to handler until ctx is done or an error wraps
// ErrUnrecoverable.
func (c *iggyConsumer) Listen(ctx context.Context, handler func(ctx context.Context, data []byte) error) error {
	failures := 0

	for {
		batch, err := c.src.Next(ctx)
		if err != nil {
			if err := handleReadError(ctx, err, &failures); err != nil {
				return err
			}
			continue
		}
		failures = 0

		if err := c.handleBatch(ctx, batch, handler); err != nil {
			return err
		}
	}
}

// Close closes the reader (which leaves the group) then the client.
func (c *iggyConsumer) Close() error {
	log.Printf("bus: closing iggy consumer\n")

	ctx, cancel := context.WithTimeout(context.Background(), iggyCloseTimeout)
	defer cancel()
	return errors.Join(c.src.Close(ctx), c.client.Close())
}
