package bus

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"cloud.google.com/go/pubsub/v2"
	"github.com/apache/iggy/foreign/go/client/reader"
	iggcon "github.com/apache/iggy/foreign/go/contracts"
	ierror "github.com/apache/iggy/foreign/go/errors"
)

type scriptStep struct {
	batch *iggcon.PolledMessage
	err   error
}

// fakeSource replays a script then cancels the listen context.
type fakeSource struct {
	mu              sync.Mutex
	script          []scriptStep
	events          []string
	commitErr       error
	seekErr         error
	closeErr        error
	closed          bool
	cancel          context.CancelFunc
	commitErrAtCall error
}

func (f *fakeSource) Next(ctx context.Context) (*iggcon.PolledMessage, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.script) == 0 {
		f.cancel()
		return nil, ctx.Err()
	}
	step := f.script[0]
	f.script = f.script[1:]
	return step.batch, step.err
}

func (f *fakeSource) Commit(ctx context.Context, cp iggcon.Checkpoint) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.commitErrAtCall = ctx.Err()
	f.events = append(f.events, fmt.Sprintf("commit:%d", cp.Offset()))
	return f.commitErr
}

func (f *fakeSource) Seek(_ context.Context, _ uint32, start iggcon.PollingStrategy) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.events = append(f.events, fmt.Sprintf("seek:%d", start.Value))
	return f.seekErr
}

func (f *fakeSource) Close(context.Context) error {
	f.closed = true
	return f.closeErr
}

type stubClient struct {
	iggcon.Client
	mu        sync.Mutex
	sent      [][]byte
	sendErr   error
	abandoned []uint64
	closed    bool
	closeErr  error
}

func (s *stubClient) SendMessages(_ context.Context, _, _ iggcon.Identifier, _ iggcon.Partitioning, msgs []iggcon.IggyMessage) (*iggcon.SendMessagesResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.sendErr != nil {
		return nil, s.sendErr
	}
	s.sent = append(s.sent, msgs[0].Payload)
	return nil, nil
}

func (s *stubClient) AbandonOperation(_ context.Context, id uint64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.abandoned = append(s.abandoned, id)
	return nil
}

func (s *stubClient) Close() error {
	s.closed = true
	return s.closeErr
}

func batchOf(firstOffset uint64, payloads ...string) *iggcon.PolledMessage {
	msgs := make([]iggcon.IggyMessage, len(payloads))
	for i, p := range payloads {
		msgs[i] = iggcon.IggyMessage{Header: iggcon.MessageHeader{Offset: firstOffset + uint64(i)}, Payload: []byte(p)}
	}
	return &iggcon.PolledMessage{PartitionId: 7, Messages: msgs}
}

func okStep(b *iggcon.PolledMessage) scriptStep { return scriptStep{batch: b} }
func errStep(err error) scriptStep              { return scriptStep{err: err} }

func wholeReaderErr() scriptStep {
	return errStep(&reader.ReadError{Err: errors.New("read failed")})
}

func newTestConsumer(steps ...scriptStep) (*iggyConsumer, *fakeSource, context.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	src := &fakeSource{script: steps, cancel: cancel}
	c := &iggyConsumer{client: &stubClient{}, src: src, pollInterval: time.Millisecond, processingConcurrency: 1}
	return c, src, ctx
}

func failOn(bad string) func(context.Context, []byte) error {
	return func(_ context.Context, data []byte) error {
		if string(data) == bad {
			return errors.New("handler failed")
		}
		return nil
	}
}

func newTestProducer(client iggcon.Client) *iggyProducer {
	streamID, _ := iggcon.NewIdentifier("test-stream")
	topicID, _ := iggcon.NewIdentifier("test-topic")
	return &iggyProducer{client: client, streamID: streamID, topicID: topicID}
}

func TestDefaultStreamName(t *testing.T) {
	if DefaultStreamName != "measure" {
		t.Errorf("DefaultStreamName = %q, want %q", DefaultStreamName, "measure")
	}
}

func TestIggyOptions(t *testing.T) {
	cfg := &iggyConfig{}
	if cfg.batchSizeOrDefault() != 500 || cfg.pollIntervalOrDefault() != 500*time.Millisecond || cfg.processingConcurrencyOrDefault() != 1 {
		t.Fatalf("unexpected defaults: %d %v %d", cfg.batchSizeOrDefault(), cfg.pollIntervalOrDefault(), cfg.processingConcurrencyOrDefault())
	}
	WithIggyBatchSize(100)(cfg)
	WithIggyPollInterval(5 * time.Second)(cfg)
	WithIggyProcessingConcurrency(3)(cfg)
	if cfg.batchSizeOrDefault() != 100 || cfg.pollIntervalOrDefault() != 5*time.Second || cfg.processingConcurrencyOrDefault() != 3 {
		t.Errorf("options not applied: %+v", cfg)
	}
}

func TestPollOptions(t *testing.T) {
	opts := pollOptions(50, 2*time.Second)
	if opts.Count != 50 || opts.MaxWait != 2*time.Second || opts.MaxBytes != iggyPollMaxBytes || opts.Commit.Kind != iggcon.CommitManual {
		t.Errorf("pollOptions = %+v", opts)
	}
	if err := opts.Validate(); err != nil {
		t.Errorf("Validate() = %v", err)
	}
}

func TestWithPubSubProjectID(t *testing.T) {
	cfg := &pubSubConfig{}
	WithPubSubProjectID("my-project")(cfg)

	if cfg.projectID != "my-project" {
		t.Errorf("projectID = %q, want %q", cfg.projectID, "my-project")
	}
}

func TestWithPubSubReceiveSettings(t *testing.T) {
	cfg := &pubSubConfig{}
	WithPubSubReceiveSettings(pubsub.ReceiveSettings{MaxOutstandingMessages: 50})(cfg)

	if cfg.receiveSettings == nil {
		t.Fatal("receiveSettings is nil, want non-nil")
	}
	if cfg.receiveSettings.MaxOutstandingMessages != 50 {
		t.Errorf("MaxOutstandingMessages = %d, want 50", cfg.receiveSettings.MaxOutstandingMessages)
	}
}

func TestWithPubSubPublishSettings(t *testing.T) {
	cfg := &pubSubConfig{}
	WithPubSubPublishSettings(func(s *pubsub.PublishSettings) {
		s.CountThreshold = 25
	})(cfg)

	if cfg.publishSettings == nil {
		t.Fatal("publishSettings is nil, want non-nil")
	}

	settings := pubsub.DefaultPublishSettings
	cfg.publishSettings(&settings)

	if settings.CountThreshold != 25 {
		t.Errorf("CountThreshold = %d, want 25", settings.CountThreshold)
	}
	// fields the caller left alone keep their defaults rather than zeroing.
	if settings.Timeout != pubsub.DefaultPublishSettings.Timeout {
		t.Errorf("Timeout = %v, want %v", settings.Timeout, pubsub.DefaultPublishSettings.Timeout)
	}
}

func TestIggyConsumerListen(t *testing.T) {
	cases := []struct {
		name       string
		steps      []scriptStep
		handler    func(context.Context, []byte) error
		commitErr  error
		seekErr    error
		wantEvents []string
		wantErr    error
		unrecover  bool
	}{
		{name: "empty_script_returns_ctx_err", wantErr: context.Canceled},
		{name: "success_commits_last_offset", steps: []scriptStep{okStep(batchOf(10, "a", "b"))}, wantEvents: []string{"commit:11"}, wantErr: context.Canceled},
		{name: "failure_commits_prefix_then_seeks", steps: []scriptStep{okStep(batchOf(10, "a", "b", "c"))}, handler: failOn("b"), wantEvents: []string{"commit:10", "seek:11"}, wantErr: context.Canceled},
		{name: "first_failure_seeks_without_commit", steps: []scriptStep{okStep(batchOf(10, "a", "b"))}, handler: failOn("a"), wantEvents: []string{"seek:10"}, wantErr: context.Canceled},
		{name: "commit_error_redelivers_from_start", steps: []scriptStep{okStep(batchOf(10, "a", "b"))}, commitErr: errors.New("store failed"), wantEvents: []string{"commit:11", "seek:10"}, wantErr: context.Canceled},
		{name: "seek_invalid_command_continues", steps: []scriptStep{okStep(batchOf(10, "a", "b")), okStep(batchOf(20, "c"))}, handler: failOn("b"), seekErr: ierror.ErrInvalidCommand, wantEvents: []string{"commit:10", "seek:11", "commit:20"}, wantErr: context.Canceled},
		{name: "seek_other_error_is_unrecoverable", steps: []scriptStep{okStep(batchOf(10, "a", "b"))}, handler: failOn("b"), seekErr: errors.New("seek failed"), wantEvents: []string{"commit:10", "seek:11"}, unrecover: true},
		{name: "non_read_error_is_unrecoverable", steps: []scriptStep{errStep(errors.New("boom"))}, unrecover: true},
		{name: "partition_read_error_is_unrecoverable", steps: []scriptStep{errStep(&reader.ReadError{PartitionID: new(uint32), Err: errors.New("bad")})}, unrecover: true},
		{name: "partition_not_owned_continues", steps: []scriptStep{errStep(&reader.ReadError{PartitionID: new(uint32), Err: ierror.ErrConsumerGroupPartitionNotOwned}), okStep(batchOf(10, "a"))}, wantEvents: []string{"commit:10"}, wantErr: context.Canceled},
		{name: "five_read_errors_are_unrecoverable", steps: []scriptStep{wholeReaderErr(), wholeReaderErr(), wholeReaderErr(), wholeReaderErr(), wholeReaderErr()}, unrecover: true},
		{name: "success_resets_read_error_count", steps: []scriptStep{wholeReaderErr(), wholeReaderErr(), wholeReaderErr(), wholeReaderErr(), okStep(batchOf(10, "a")), wholeReaderErr(), wholeReaderErr(), wholeReaderErr(), wholeReaderErr()}, wantEvents: []string{"commit:10"}, wantErr: context.Canceled},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, src, ctx := newTestConsumer(tc.steps...)
			src.commitErr, src.seekErr = tc.commitErr, tc.seekErr
			handler := tc.handler
			if handler == nil {
				handler = func(context.Context, []byte) error { return nil }
			}

			err := c.Listen(ctx, handler)

			if tc.unrecover != errors.Is(err, ErrUnrecoverable) {
				t.Errorf("err = %v, unrecoverable want %v", err, tc.unrecover)
			}
			if tc.wantErr != nil && !errors.Is(err, tc.wantErr) {
				t.Errorf("err = %v, want %v", err, tc.wantErr)
			}
			if fmt.Sprint(src.events) != fmt.Sprint(tc.wantEvents) {
				t.Errorf("events = %v, want %v", src.events, tc.wantEvents)
			}
		})
	}
}

func TestIggyConsumerConcurrentWindow(t *testing.T) {
	c, src, ctx := newTestConsumer(okStep(batchOf(10, "a", "b", "c")))
	c.processingConcurrency = 2

	started := make(chan struct{}, 2)
	release := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		done <- c.Listen(ctx, func(_ context.Context, data []byte) error {
			if string(data) == "c" {
				return nil
			}
			started <- struct{}{}
			<-release
			return nil
		})
	}()

	for range 2 {
		select {
		case <-started:
		case <-time.After(time.Second):
			t.Fatal("handlers did not start concurrently")
		}
	}
	close(release)

	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	if fmt.Sprint(src.events) != "[commit:12]" {
		t.Errorf("events = %v, want [commit:12]", src.events)
	}
}

func TestIggyConsumerConcurrentFailureCommitsPrefix(t *testing.T) {
	c, src, ctx := newTestConsumer(okStep(batchOf(10, "a", "b", "c")))
	c.processingConcurrency = 3

	_ = c.Listen(ctx, failOn("b"))

	if fmt.Sprint(src.events) != "[commit:10 seek:11]" {
		t.Errorf("events = %v, want [commit:10 seek:11]", src.events)
	}
}

func TestIggyConsumerCommitSurvivesCancel(t *testing.T) {
	c, src, ctx := newTestConsumer(okStep(batchOf(10, "a")))
	ctx, cancel := context.WithCancel(ctx)
	src.cancel = cancel

	_ = c.Listen(ctx, func(context.Context, []byte) error {
		cancel()
		return nil
	})

	if len(src.events) != 1 || src.commitErrAtCall != nil {
		t.Errorf("events = %v, commit ctx err = %v, want one commit with live ctx", src.events, src.commitErrAtCall)
	}
}

func TestIggyConsumerClose(t *testing.T) {
	c, src, _ := newTestConsumer()
	client := c.client.(*stubClient)
	src.closeErr = errors.New("reader close failed")

	err := c.Close()

	if !errors.Is(err, src.closeErr) {
		t.Errorf("Close() = %v, want reader error", err)
	}
	if !src.closed || !client.closed {
		t.Errorf("closed: reader=%v client=%v, want both", src.closed, client.closed)
	}
}

func TestIggyProducerPublish(t *testing.T) {
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()

	cases := []struct {
		name          string
		ctx           context.Context
		sendErr       error
		wantUnrecover bool
		wantOversized bool
		wantAbandoned []uint64
	}{
		{name: "success", ctx: context.Background()},
		{name: "send_error_is_unrecoverable", ctx: context.Background(), sendErr: errors.New("network failure"), wantUnrecover: true},
		{name: "oversized_is_not_unrecoverable", ctx: context.Background(), sendErr: ierror.ErrTooBigMessagePayload, wantOversized: true},
		{name: "uncertain_abandons", ctx: context.Background(), sendErr: ierror.OperationUncertain{OperationID: 5}, wantAbandoned: []uint64{5}},
		{name: "partition_lane_blocked_abandons", ctx: context.Background(), sendErr: ierror.PartitionLaneBlocked{PartitionID: 1, OperationID: 6}, wantAbandoned: []uint64{6}},
		{name: "cancelled_ctx_is_not_unrecoverable", ctx: cancelled, sendErr: errors.New("canceled")},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			client := &stubClient{sendErr: tc.sendErr}
			err := newTestProducer(client).Publish(tc.ctx, []byte("hello"))

			if tc.sendErr == nil {
				if err != nil || len(client.sent) != 1 || !bytes.Equal(client.sent[0], []byte("hello")) {
					t.Fatalf("err = %v, sent = %q", err, client.sent)
				}
				return
			}
			if err == nil {
				t.Fatal("expected error")
			}
			if errors.Is(err, ErrUnrecoverable) != tc.wantUnrecover {
				t.Errorf("err = %v, unrecoverable want %v", err, tc.wantUnrecover)
			}
			if IsOversized(err) != tc.wantOversized {
				t.Errorf("IsOversized(%v) = %v, want %v", err, IsOversized(err), tc.wantOversized)
			}
			if fmt.Sprint(client.abandoned) != fmt.Sprint(tc.wantAbandoned) {
				t.Errorf("abandoned = %v, want %v", client.abandoned, tc.wantAbandoned)
			}
		})
	}
}

func TestIggyProducerPublishOrdered(t *testing.T) {
	client := &stubClient{}

	if err := newTestProducer(client).PublishOrdered(context.Background(), "C1:1", []byte("hello")); err != nil {
		t.Fatalf("PublishOrdered() error = %v", err)
	}
	if len(client.sent) != 1 || !bytes.Equal(client.sent[0], []byte("hello")) {
		t.Errorf("sent = %q, want [hello]", client.sent)
	}
}

func TestIggyProducerClose(t *testing.T) {
	client := &stubClient{}

	if err := newTestProducer(client).Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
	if !client.closed {
		t.Error("Close was not called on the client")
	}
}
