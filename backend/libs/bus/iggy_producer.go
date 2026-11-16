package bus

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	iggcon "github.com/apache/iggy/foreign/go/contracts"
	ierror "github.com/apache/iggy/foreign/go/errors"
)

// iggyAbandonTimeout bounds releasing a blocked send lane.
const iggyAbandonTimeout = 5 * time.Second

type iggyProducer struct {
	// client is the underlying Iggy client.
	client iggcon.Client
	// streamID identifies the target Iggy stream.
	streamID iggcon.Identifier
	// topicID identifies the target Iggy topic within the stream.
	topicID iggcon.Identifier
}

// NewIggyProducer creates an Iggy-backed Producer.
// address is "host:port"; username and password are required for authentication.
// streamName and topicName identify the target stream/topic.
// Messages are distributed using the balanced (round-robin) partitioning scheme.
func NewIggyProducer(address, username, password, consumerName, streamName, topicName string, opts ...IggyOption) (Producer, error) {
	streamID, err := iggcon.NewIdentifier(streamName)
	if err != nil {
		return nil, fmt.Errorf("bus: invalid Iggy stream name: %w", err)
	}
	topicID, err := iggcon.NewIdentifier(topicName)
	if err != nil {
		return nil, fmt.Errorf("bus: invalid Iggy topic name: %w", err)
	}

	client, err := newIggyClient(address, username, password)
	if err != nil {
		return nil, err
	}

	return &iggyProducer{client: client, streamID: streamID, topicID: topicID}, nil
}

// blockedOperationID returns the ID of an uncertain or lane-blocking send.
func blockedOperationID(err error) (id uint64, ok bool) {
	var uncertain ierror.OperationUncertain
	if errors.As(err, &uncertain) {
		return uncertain.OperationID, true
	}
	var blocked ierror.LaneBlocked
	if errors.As(err, &blocked) {
		return blocked.OperationID, true
	}
	return 0, false
}

// abandon releases the send lane held by operationID. The lane is released
// even when ctx is cancelled.
func (p *iggyProducer) abandon(ctx context.Context, operationID uint64) {
	abandonCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), iggyAbandonTimeout)
	defer cancel()
	err := p.client.AbandonOperation(abandonCtx, operationID)
	if err != nil && !errors.Is(err, ierror.ErrOperationNotRetained) {
		log.Printf("bus: iggy abandon of operation %d failed: %v", operationID, err)
	}
}

// sendError classifies a failed send. Oversized payloads, cancelled contexts
// & uncertain or lane-blocked sends return plain errors. Uncertain sends also
// release their lane. Anything else wraps ErrUnrecoverable.
func (p *iggyProducer) sendError(ctx context.Context, err error) error {
	if IsOversized(err) {
		return fmt.Errorf("bus: Iggy send failed: %w", err)
	}
	if id, ok := blockedOperationID(err); ok {
		p.abandon(ctx, id)
		return fmt.Errorf("bus: Iggy send failed: %w", err)
	}
	if ctx.Err() != nil {
		return fmt.Errorf("bus: Iggy send failed: %w", err)
	}
	return fmt.Errorf("bus: Iggy send failed: %w: %w", ErrUnrecoverable, err)
}

// Publish sends data as one message & discards the confirmation.
func (p *iggyProducer) Publish(ctx context.Context, data []byte) error {
	msg, err := iggcon.NewIggyMessage(data)
	if err != nil {
		return fmt.Errorf("bus: failed to create Iggy message: %w", err)
	}
	if _, err := p.client.SendMessages(ctx, p.streamID, p.topicID, iggcon.None(), []iggcon.IggyMessage{msg}); err != nil {
		return p.sendError(ctx, err)
	}
	return nil
}

// PublishOrdered ignores the ordering key: Iggy's ordering comes from the
// topic's partitioning and its serial consumers, not from a per-message key,
// so a plain publish already carries the guarantee the key asks for.
func (p *iggyProducer) PublishOrdered(ctx context.Context, _ string, data []byte) error {
	return p.Publish(ctx, data)
}

// Close closes the client.
func (p *iggyProducer) Close() error {
	return p.client.Close()
}
