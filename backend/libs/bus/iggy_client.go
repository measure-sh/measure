package bus

import (
	"context"
	"fmt"
	"time"

	iggclient "github.com/apache/iggy/foreign/go/client"
	"github.com/apache/iggy/foreign/go/client/tcp"
	iggcon "github.com/apache/iggy/foreign/go/contracts"
)

// iggyConnectTimeout bounds the initial connect & login.
const iggyConnectTimeout = 15 * time.Second

// newIggyClient returns a connected TCP client that logs in with the given
// credentials & logs in again after the session is recovered.
func newIggyClient(address, username, password string) (client iggcon.Client, err error) {
	client, err = iggclient.NewIggyClient(iggclient.WithTcp(
		tcp.WithServerAddress(address),
		tcp.WithAutoLogin(tcp.NewUsernamePasswordCredentials(username, password)),
	))
	if err != nil {
		return nil, fmt.Errorf("bus: failed to create Iggy client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), iggyConnectTimeout)
	defer cancel()
	if err := client.Connect(ctx); err != nil {
		client.Close()
		return nil, fmt.Errorf("bus: Iggy connect failed: %w", err)
	}
	return client, nil
}
