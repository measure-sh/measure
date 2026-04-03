package bus

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"cloud.google.com/go/pubsub/v2"
	iggcon "github.com/apache/iggy/foreign/go/contracts"
)

// --- Mock types ---

type storedOffset struct {
	Offset      uint64
	PartitionID uint32
}

type sentMessage struct {
	StreamID     iggcon.Identifier
	TopicID      iggcon.Identifier
	Partitioning iggcon.Partitioning
	Messages     []iggcon.IggyMessage
}

type mockIggyClient struct {
	mu sync.Mutex

	pollFn           func(iggcon.Identifier, iggcon.Identifier, iggcon.Consumer, iggcon.PollingStrategy, uint32, bool, *uint32) (*iggcon.PolledMessage, error)
	offsets          []storedOffset
	sentMessages     []sentMessage
	sendErr          error
	leaveGroupCalled bool
	closeCalled      bool
}

func (m *mockIggyClient) PollMessages(streamId, topicId iggcon.Identifier, consumer iggcon.Consumer, strategy iggcon.PollingStrategy, count uint32, autoCommit bool, partitionId *uint32) (*iggcon.PolledMessage, error) {
	if m.pollFn != nil {
		return m.pollFn(streamId, topicId, consumer, strategy, count, autoCommit, partitionId)
	}
	return nil, nil
}

func (m *mockIggyClient) StoreConsumerOffset(_ iggcon.Consumer, _ iggcon.Identifier, _ iggcon.Identifier, offset uint64, partitionId *uint32) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	var pid uint32
	if partitionId != nil {
		pid = *partitionId
	}
	m.offsets = append(m.offsets, storedOffset{Offset: offset, PartitionID: pid})
	return nil
}

func (m *mockIggyClient) SendMessages(streamId, topicId iggcon.Identifier, partitioning iggcon.Partitioning, messages []iggcon.IggyMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sentMessages = append(m.sentMessages, sentMessage{
		StreamID: streamId, TopicID: topicId, Partitioning: partitioning, Messages: messages,
	})
	return m.sendErr
}

func (m *mockIggyClient) LeaveConsumerGroup(_, _, _ iggcon.Identifier) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.leaveGroupCalled = true
	return nil
}

func (m *mockIggyClient) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.closeCalled = true
	return nil
}

// Unused interface methods — required to satisfy the iggcon.Client interface.
// Panic to catch unexpected calls during testing.

func (m *mockIggyClient) GetConnectionInfo() *iggcon.ConnectionInfo { panic("not implemented") }
func (m *mockIggyClient) GetClusterMetadata() (*iggcon.ClusterMetadata, error) {
	panic("not implemented")
}
func (m *mockIggyClient) GetStream(iggcon.Identifier) (*iggcon.StreamDetails, error) {
	panic("not implemented")
}
func (m *mockIggyClient) GetStreams() ([]iggcon.Stream, error) { panic("not implemented") }
func (m *mockIggyClient) CreateStream(string) (*iggcon.StreamDetails, error) {
	panic("not implemented")
}
func (m *mockIggyClient) UpdateStream(iggcon.Identifier, string) error { panic("not implemented") }
func (m *mockIggyClient) DeleteStream(iggcon.Identifier) error         { panic("not implemented") }
func (m *mockIggyClient) GetTopic(iggcon.Identifier, iggcon.Identifier) (*iggcon.TopicDetails, error) {
	panic("not implemented")
}
func (m *mockIggyClient) GetTopics(iggcon.Identifier) ([]iggcon.Topic, error) {
	panic("not implemented")
}
func (m *mockIggyClient) CreateTopic(iggcon.Identifier, string, uint32, iggcon.CompressionAlgorithm, iggcon.Duration, uint64, *uint8) (*iggcon.TopicDetails, error) {
	panic("not implemented")
}
func (m *mockIggyClient) UpdateTopic(iggcon.Identifier, iggcon.Identifier, string, iggcon.CompressionAlgorithm, iggcon.Duration, uint64, *uint8) error {
	panic("not implemented")
}
func (m *mockIggyClient) DeleteTopic(iggcon.Identifier, iggcon.Identifier) error {
	panic("not implemented")
}
func (m *mockIggyClient) GetConsumerOffset(iggcon.Consumer, iggcon.Identifier, iggcon.Identifier, *uint32) (*iggcon.ConsumerOffsetInfo, error) {
	panic("not implemented")
}
func (m *mockIggyClient) GetConsumerGroups(iggcon.Identifier, iggcon.Identifier) ([]iggcon.ConsumerGroup, error) {
	panic("not implemented")
}
func (m *mockIggyClient) DeleteConsumerOffset(iggcon.Consumer, iggcon.Identifier, iggcon.Identifier, *uint32) error {
	panic("not implemented")
}
func (m *mockIggyClient) GetConsumerGroup(iggcon.Identifier, iggcon.Identifier, iggcon.Identifier) (*iggcon.ConsumerGroupDetails, error) {
	panic("not implemented")
}
func (m *mockIggyClient) CreateConsumerGroup(iggcon.Identifier, iggcon.Identifier, string) (*iggcon.ConsumerGroupDetails, error) {
	panic("not implemented")
}
func (m *mockIggyClient) DeleteConsumerGroup(iggcon.Identifier, iggcon.Identifier, iggcon.Identifier) error {
	panic("not implemented")
}
func (m *mockIggyClient) JoinConsumerGroup(iggcon.Identifier, iggcon.Identifier, iggcon.Identifier) error {
	panic("not implemented")
}
func (m *mockIggyClient) CreatePartitions(iggcon.Identifier, iggcon.Identifier, uint32) error {
	panic("not implemented")
}
func (m *mockIggyClient) DeletePartitions(iggcon.Identifier, iggcon.Identifier, uint32) error {
	panic("not implemented")
}
func (m *mockIggyClient) GetUser(iggcon.Identifier) (*iggcon.UserInfoDetails, error) {
	panic("not implemented")
}
func (m *mockIggyClient) GetUsers() ([]iggcon.UserInfo, error) { panic("not implemented") }
func (m *mockIggyClient) CreateUser(string, string, iggcon.UserStatus, *iggcon.Permissions) (*iggcon.UserInfoDetails, error) {
	panic("not implemented")
}
func (m *mockIggyClient) UpdateUser(iggcon.Identifier, *string, *iggcon.UserStatus) error {
	panic("not implemented")
}
func (m *mockIggyClient) UpdatePermissions(iggcon.Identifier, *iggcon.Permissions) error {
	panic("not implemented")
}
func (m *mockIggyClient) ChangePassword(iggcon.Identifier, string, string) error {
	panic("not implemented")
}
func (m *mockIggyClient) DeleteUser(iggcon.Identifier) error { panic("not implemented") }
func (m *mockIggyClient) CreatePersonalAccessToken(string, uint32) (*iggcon.RawPersonalAccessToken, error) {
	panic("not implemented")
}
func (m *mockIggyClient) DeletePersonalAccessToken(string) error { panic("not implemented") }
func (m *mockIggyClient) GetPersonalAccessTokens() ([]iggcon.PersonalAccessTokenInfo, error) {
	panic("not implemented")
}
func (m *mockIggyClient) LoginWithPersonalAccessToken(string) (*iggcon.IdentityInfo, error) {
	panic("not implemented")
}
func (m *mockIggyClient) LoginUser(string, string) (*iggcon.IdentityInfo, error) {
	panic("not implemented")
}
func (m *mockIggyClient) LogoutUser() error                           { panic("not implemented") }
func (m *mockIggyClient) GetStats() (*iggcon.Stats, error)            { panic("not implemented") }
func (m *mockIggyClient) Ping() error                                 { panic("not implemented") }
func (m *mockIggyClient) GetClients() ([]iggcon.ClientInfo, error)    { panic("not implemented") }
func (m *mockIggyClient) GetClient(uint32) (*iggcon.ClientInfoDetails, error) {
	panic("not implemented")
}

// --- Test helpers ---

func newTestConsumer(client iggcon.Client, kind iggcon.ConsumerKind) *iggyConsumer {
	streamID, _ := iggcon.NewIdentifier("test-stream")
	topicID, _ := iggcon.NewIdentifier("test-topic")
	consumerID, _ := iggcon.NewIdentifier("test-consumer")

	var consumer iggcon.Consumer
	if kind == iggcon.ConsumerKindGroup {
		consumer = iggcon.NewGroupConsumer(consumerID)
	} else {
		consumer = iggcon.NewSingleConsumer(consumerID)
	}

	return &iggyConsumer{
		client:          client,
		streamID:        streamID,
		topicID:         topicID,
		consumer:        consumer,
		partID:          nil,
		batchSize:       10,
		pollInterval:    1 * time.Millisecond,
		pollingStrategy: iggcon.NextPollingStrategy(),
	}
}

func newTestProducer(client iggcon.Client) *iggyProducer {
	streamID, _ := iggcon.NewIdentifier("test-stream")
	topicID, _ := iggcon.NewIdentifier("test-topic")

	return &iggyProducer{
		client:       client,
		streamID:     streamID,
		topicID:      topicID,
		partitioning: iggcon.None(),
	}
}

// --- Option function tests ---

func TestDefaultStreamName(t *testing.T) {
	if DefaultStreamName != "measure" {
		t.Errorf("DefaultStreamName = %q, want %q", DefaultStreamName, "measure")
	}
}

func TestWithIggyPartitionID(t *testing.T) {
	cfg := &iggyConfig{}
	WithIggyPartitionID(42)(cfg)

	if cfg.partitionID != 42 {
		t.Errorf("partitionID = %d, want 42", cfg.partitionID)
	}
	if cfg.partitioningKind != iggcon.PartitionIdKind {
		t.Errorf("partitioningKind = %d, want PartitionIdKind (%d)", cfg.partitioningKind, iggcon.PartitionIdKind)
	}
}

func TestWithIggyMessageKey(t *testing.T) {
	cfg := &iggyConfig{}
	key := []byte("routing-key")
	WithIggyMessageKey(key)(cfg)

	if !bytes.Equal(cfg.messageKey, key) {
		t.Errorf("messageKey = %q, want %q", cfg.messageKey, key)
	}
	if cfg.partitioningKind != iggcon.MessageKey {
		t.Errorf("partitioningKind = %d, want MessageKey (%d)", cfg.partitioningKind, iggcon.MessageKey)
	}
}

func TestWithIggyBatchSize(t *testing.T) {
	cfg := &iggyConfig{}
	WithIggyBatchSize(100)(cfg)

	if cfg.batchSize != 100 {
		t.Errorf("batchSize = %d, want 100", cfg.batchSize)
	}
}

func TestWithIggyPollInterval(t *testing.T) {
	cfg := &iggyConfig{}
	WithIggyPollInterval(5 * time.Second)(cfg)

	if cfg.pollInterval != 5*time.Second {
		t.Errorf("pollInterval = %v, want 5s", cfg.pollInterval)
	}
}

func TestWithIggyPollingStrategy(t *testing.T) {
	cfg := &iggyConfig{}
	s := iggcon.FirstPollingStrategy()
	WithIggyPollingStrategy(s)(cfg)

	if cfg.pollingStrategy == nil {
		t.Fatal("pollingStrategy is nil, want non-nil")
	}
	if cfg.pollingStrategy.Kind != iggcon.POLLING_FIRST {
		t.Errorf("pollingStrategy.Kind = %d, want POLLING_FIRST (%d)", cfg.pollingStrategy.Kind, iggcon.POLLING_FIRST)
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
	WithPubSubPublishSettings(pubsub.PublishSettings{CountThreshold: 25})(cfg)

	if cfg.publishSettings == nil {
		t.Fatal("publishSettings is nil, want non-nil")
	}
	if cfg.publishSettings.CountThreshold != 25 {
		t.Errorf("CountThreshold = %d, want 25", cfg.publishSettings.CountThreshold)
	}
}

// --- Iggy consumer Listen tests ---

func TestIggyConsumerListen(t *testing.T) {
	t.Run("context_cancellation", func(t *testing.T) {
		mock := &mockIggyClient{}
		mock.pollFn = func(_ iggcon.Identifier, _ iggcon.Identifier, _ iggcon.Consumer, _ iggcon.PollingStrategy, _ uint32, _ bool, _ *uint32) (*iggcon.PolledMessage, error) {
			return nil, nil
		}
		c := newTestConsumer(mock, iggcon.ConsumerKindSingle)

		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		err := c.Listen(ctx, func(_ context.Context, _ []byte) error {
			return nil
		})

		if !errors.Is(err, context.Canceled) {
			t.Errorf("err = %v, want context.Canceled", err)
		}
	})

	t.Run("poll_error_retries_then_fatal", func(t *testing.T) {
		var calls atomic.Int32
		mock := &mockIggyClient{}
		mock.pollFn = func(_ iggcon.Identifier, _ iggcon.Identifier, _ iggcon.Consumer, _ iggcon.PollingStrategy, _ uint32, _ bool, _ *uint32) (*iggcon.PolledMessage, error) {
			calls.Add(1)
			return nil, errors.New("connection lost")
		}
		c := newTestConsumer(mock, iggcon.ConsumerKindSingle)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := c.Listen(ctx, func(_ context.Context, _ []byte) error {
			return nil
		})

		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !strings.Contains(err.Error(), "poll failed after 5 consecutive attempts") {
			t.Errorf("err = %v, want message containing 'poll failed after 5 consecutive attempts'", err)
		}
		if n := calls.Load(); n != 5 {
			t.Errorf("poll called %d times, want 5", n)
		}
	})

	t.Run("poll_error_resets_on_success", func(t *testing.T) {
		var calls atomic.Int32
		mock := &mockIggyClient{}
		mock.pollFn = func(_ iggcon.Identifier, _ iggcon.Identifier, _ iggcon.Consumer, _ iggcon.PollingStrategy, _ uint32, _ bool, _ *uint32) (*iggcon.PolledMessage, error) {
			n := int(calls.Add(1))
			// Calls 1-3: fail
			if n <= 3 {
				return nil, errors.New("transient error")
			}
			// Call 4: succeed with empty result
			if n == 4 {
				return nil, nil
			}
			// Calls 5-9: fail (5 consecutive -> fatal)
			return nil, errors.New("persistent error")
		}
		c := newTestConsumer(mock, iggcon.ConsumerKindSingle)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := c.Listen(ctx, func(_ context.Context, _ []byte) error {
			return nil
		})

		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !strings.Contains(err.Error(), "poll failed after 5 consecutive attempts") {
			t.Errorf("err = %v, want message containing 'poll failed after 5 consecutive attempts'", err)
		}
		if n := calls.Load(); n != 9 {
			t.Errorf("poll called %d times, want 9", n)
		}
	})

	t.Run("processes_messages_and_commits_offsets", func(t *testing.T) {
		var callCount atomic.Int32
		cancel2 := context.CancelFunc(nil)

		mock := &mockIggyClient{}
		mock.pollFn = func(_ iggcon.Identifier, _ iggcon.Identifier, _ iggcon.Consumer, _ iggcon.PollingStrategy, _ uint32, _ bool, _ *uint32) (*iggcon.PolledMessage, error) {
			n := int(callCount.Add(1))
			if n == 1 {
				return &iggcon.PolledMessage{
					PartitionId: 7,
					Messages: []iggcon.IggyMessage{
						{Header: iggcon.MessageHeader{Offset: 10}, Payload: []byte("msg-a")},
						{Header: iggcon.MessageHeader{Offset: 11}, Payload: []byte("msg-b")},
						{Header: iggcon.MessageHeader{Offset: 12}, Payload: []byte("msg-c")},
					},
				}, nil
			}
			cancel2()
			return nil, nil
		}
		c := newTestConsumer(mock, iggcon.ConsumerKindSingle)

		ctx, cancel := context.WithCancel(context.Background())
		cancel2 = cancel

		var payloads []string
		err := c.Listen(ctx, func(_ context.Context, data []byte) error {
			payloads = append(payloads, string(data))
			return nil
		})

		if !errors.Is(err, context.Canceled) {
			t.Errorf("err = %v, want context.Canceled", err)
		}
		if len(payloads) != 3 {
			t.Fatalf("handler called %d times, want 3", len(payloads))
		}
		want := []string{"msg-a", "msg-b", "msg-c"}
		for i, w := range want {
			if payloads[i] != w {
				t.Errorf("payload[%d] = %q, want %q", i, payloads[i], w)
			}
		}

		mock.mu.Lock()
		defer mock.mu.Unlock()
		if len(mock.offsets) != 3 {
			t.Fatalf("offsets committed = %d, want 3", len(mock.offsets))
		}
		wantOffsets := []uint64{10, 11, 12}
		for i, wo := range wantOffsets {
			if mock.offsets[i].Offset != wo {
				t.Errorf("offset[%d] = %d, want %d", i, mock.offsets[i].Offset, wo)
			}
			if mock.offsets[i].PartitionID != 7 {
				t.Errorf("offset[%d].PartitionID = %d, want 7", i, mock.offsets[i].PartitionID)
			}
		}
	})

	t.Run("handler_error_breaks_batch", func(t *testing.T) {
		var callCount atomic.Int32
		cancel2 := context.CancelFunc(nil)

		mock := &mockIggyClient{}
		mock.pollFn = func(_ iggcon.Identifier, _ iggcon.Identifier, _ iggcon.Consumer, _ iggcon.PollingStrategy, _ uint32, _ bool, _ *uint32) (*iggcon.PolledMessage, error) {
			n := int(callCount.Add(1))
			if n == 1 {
				return &iggcon.PolledMessage{
					PartitionId: 3,
					Messages: []iggcon.IggyMessage{
						{Header: iggcon.MessageHeader{Offset: 10}, Payload: []byte("msg-a")},
						{Header: iggcon.MessageHeader{Offset: 11}, Payload: []byte("msg-b")},
						{Header: iggcon.MessageHeader{Offset: 12}, Payload: []byte("msg-c")},
					},
				}, nil
			}
			cancel2()
			return nil, nil
		}
		c := newTestConsumer(mock, iggcon.ConsumerKindSingle)

		ctx, cancel := context.WithCancel(context.Background())
		cancel2 = cancel

		var handlerCalls int
		err := c.Listen(ctx, func(_ context.Context, _ []byte) error {
			handlerCalls++
			if handlerCalls == 2 {
				return errors.New("processing failed")
			}
			return nil
		})

		if !errors.Is(err, context.Canceled) {
			t.Errorf("err = %v, want context.Canceled", err)
		}
		if handlerCalls != 2 {
			t.Errorf("handler called %d times, want 2", handlerCalls)
		}

		mock.mu.Lock()
		defer mock.mu.Unlock()
		if len(mock.offsets) != 1 {
			t.Fatalf("offsets committed = %d, want 1", len(mock.offsets))
		}
		if mock.offsets[0].Offset != 10 {
			t.Errorf("offset[0] = %d, want 10", mock.offsets[0].Offset)
		}
	})
}

// --- Iggy consumer Close tests ---

func TestIggyConsumerClose(t *testing.T) {
	t.Run("group_consumer_leaves_group", func(t *testing.T) {
		mock := &mockIggyClient{}
		c := newTestConsumer(mock, iggcon.ConsumerKindGroup)

		if err := c.Close(); err != nil {
			t.Fatalf("Close() error = %v", err)
		}

		mock.mu.Lock()
		defer mock.mu.Unlock()
		if !mock.leaveGroupCalled {
			t.Error("LeaveConsumerGroup was not called for group consumer")
		}
		if !mock.closeCalled {
			t.Error("Close was not called on the client")
		}
	})

	t.Run("single_consumer_skips_leave", func(t *testing.T) {
		mock := &mockIggyClient{}
		c := newTestConsumer(mock, iggcon.ConsumerKindSingle)

		if err := c.Close(); err != nil {
			t.Fatalf("Close() error = %v", err)
		}

		mock.mu.Lock()
		defer mock.mu.Unlock()
		if mock.leaveGroupCalled {
			t.Error("LeaveConsumerGroup was called for single consumer")
		}
		if !mock.closeCalled {
			t.Error("Close was not called on the client")
		}
	})
}

// --- Iggy producer tests ---

func TestIggyProducerPublish(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		mock := &mockIggyClient{}
		p := newTestProducer(mock)

		if err := p.Publish(context.Background(), []byte("hello")); err != nil {
			t.Fatalf("Publish() error = %v", err)
		}

		mock.mu.Lock()
		defer mock.mu.Unlock()
		if len(mock.sentMessages) != 1 {
			t.Fatalf("sentMessages = %d, want 1", len(mock.sentMessages))
		}
		if len(mock.sentMessages[0].Messages) != 1 {
			t.Fatalf("messages in batch = %d, want 1", len(mock.sentMessages[0].Messages))
		}
		if !bytes.Equal(mock.sentMessages[0].Messages[0].Payload, []byte("hello")) {
			t.Errorf("payload = %q, want %q", mock.sentMessages[0].Messages[0].Payload, "hello")
		}
	})

	t.Run("send_error", func(t *testing.T) {
		mock := &mockIggyClient{sendErr: errors.New("network failure")}
		p := newTestProducer(mock)

		err := p.Publish(context.Background(), []byte("hello"))
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !strings.Contains(err.Error(), "Iggy send failed") {
			t.Errorf("err = %v, want message containing 'Iggy send failed'", err)
		}
	})
}

func TestIggyProducerClose(t *testing.T) {
	mock := &mockIggyClient{}
	p := newTestProducer(mock)

	if err := p.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	mock.mu.Lock()
	defer mock.mu.Unlock()
	if !mock.closeCalled {
		t.Error("Close was not called on the client")
	}
}
