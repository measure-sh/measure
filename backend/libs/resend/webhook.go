package resend

import (
	"encoding/json"
	"fmt"
	"net/http"

	svix "github.com/svix/svix-webhooks/go"
)

// EventContactUpdated is sent whenever a contact changes, including when it
// unsubscribes through the link in a mailing list email.
const EventContactUpdated = "contact.updated"

// Event is the shape of a Resend webhook event.
type Event struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// ContactData is the data payload for contact events.
type ContactData struct {
	Email        string `json:"email"`
	Unsubscribed bool   `json:"unsubscribed"`
}

// VerifyWebhook validates the Svix signature on a Resend webhook payload and
// returns the parsed Event. The secret is the webhook signing secret from the
// Resend dashboard, which starts with "whsec_".
func VerifyWebhook(headers http.Header, body []byte, secret string) (*Event, error) {
	wh, err := svix.NewWebhook(secret)
	if err != nil {
		return nil, fmt.Errorf("svix: new webhook: %w", err)
	}
	if err := wh.Verify(body, headers); err != nil {
		return nil, fmt.Errorf("svix: verify signature: %w", err)
	}

	var ev Event
	if err := json.Unmarshal(body, &ev); err != nil {
		return nil, fmt.Errorf("resend: decode event: %w", err)
	}
	return &ev, nil
}
