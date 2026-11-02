package measure

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"backend/libs/resend"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// MailingListAttributionUnsubscribeLink is the attribution of an
// unsubscribe through the link in a mailing list email.
const MailingListAttributionUnsubscribeLink = "unsubscribe_link"

// saveMailingListChange sets whether the address is subscribed and records
// the change in its history. It reports whether the state changed; an
// unchanged state is not recorded.
func saveMailingListChange(ctx context.Context, pg *pgxpool.Pool, email string, subscribed bool, attribution string) (bool, error) {
	tx, err := pg.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	// Locked, so two saves for the same address can't both see the old state.
	current := sqlf.PostgreSQL.
		Select("subscribed").
		From("mailing_list_subscribers").
		Where("email = ?", email).
		Clause("for update")
	defer current.Close()

	wasSubscribed := false
	err = tx.QueryRow(ctx, current.String(), current.Args()...).Scan(&wasSubscribed)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return false, err
	}

	upsert := sqlf.PostgreSQL.InsertInto("mailing_list_subscribers").
		Set("email", email).
		Set("subscribed", subscribed).
		Clause(`on conflict (email) do update set
			subscribed = excluded.subscribed,
			confirmation_token_hash = case when excluded.subscribed then null else mailing_list_subscribers.confirmation_token_hash end,
			confirmation_expires_at = case when excluded.subscribed then null else mailing_list_subscribers.confirmation_expires_at end,
			confirmation_attribution = case when excluded.subscribed then null else mailing_list_subscribers.confirmation_attribution end,
			updated_at = now()`).
		Returning("id")
	defer upsert.Close()

	var subscriberID string
	if err := tx.QueryRow(ctx, upsert.String(), upsert.Args()...).Scan(&subscriberID); err != nil {
		return false, err
	}

	if wasSubscribed == subscribed {
		return false, tx.Commit(ctx)
	}

	event := sqlf.PostgreSQL.InsertInto("mailing_list_subscribe_events").
		Set("subscriber_id", subscriberID).
		Set("subscribed", subscribed).
		Set("attribution", attribution)
	defer event.Close()

	if _, err := tx.Exec(ctx, event.String(), event.Args()...); err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

// MailingListSubscribed reports whether the user's address is subscribed.
func MailingListSubscribed(ctx context.Context, pg *pgxpool.Pool, userId uuid.UUID) (bool, error) {
	stmt := sqlf.PostgreSQL.
		Select("coalesce(s.subscribed, false)").
		From("users u").
		LeftJoin("mailing_list_subscribers s", "s.email = lower(u.email)").
		Where("u.id = ?", userId)
	defer stmt.Close()

	var subscribed bool
	if err := pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&subscribed); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, fmt.Errorf("no user found with id %s", userId)
		}
		return false, err
	}
	return subscribed, nil
}

// SetMailingListSubscription subscribes or unsubscribes the user in Resend,
// then saves the change.
func SetMailingListSubscription(ctx context.Context, pg *pgxpool.Pool, userId uuid.UUID, optIn bool, attribution string) error {
	user := &User{ID: new(string)}
	*user.ID = userId.String()
	if err := user.GetUserDetails(ctx, pg); err != nil {
		return err
	}
	if user.Name == nil {
		user.Name = new(string)
	}
	email := strings.ToLower(*user.Email)

	if optIn {
		if err := resend.Subscribe(ctx, email, user.FirstName()); err != nil {
			return fmt.Errorf("failed to subscribe mailing list contact: %w", err)
		}
	} else {
		if err := resend.Unsubscribe(ctx, email); err != nil {
			return fmt.Errorf("failed to unsubscribe mailing list contact: %w", err)
		}
	}

	changed, err := saveMailingListChange(ctx, pg, email, optIn, attribution)
	if err != nil {
		return err
	}
	if changed {
		fireMailingListEvent(userId.String(), email, optIn, attribution)
	}
	return nil
}

// MailingListConfirmationTTL is how long a confirmation link works.
const MailingListConfirmationTTL = 48 * time.Hour

var (
	ErrMailingListTokenInvalid = errors.New("mailing list confirmation link is invalid")
	ErrMailingListTokenExpired = errors.New("mailing list confirmation link has expired")
)

// RequestMailingListSignup stores a pending signup and returns the
// confirmation token to email to the address. A new request replaces any
// earlier token.
func RequestMailingListSignup(ctx context.Context, pg *pgxpool.Pool, email, attribution string) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(b)

	stmt := sqlf.PostgreSQL.InsertInto("mailing_list_subscribers").
		Set("email", strings.ToLower(email)).
		Set("confirmation_token_hash", hashMailingListToken(token)).
		Set("confirmation_expires_at", time.Now().Add(MailingListConfirmationTTL)).
		Set("confirmation_attribution", attribution).
		Clause(`on conflict (email) do update set
			confirmation_token_hash = excluded.confirmation_token_hash,
			confirmation_expires_at = excluded.confirmation_expires_at,
			confirmation_attribution = excluded.confirmation_attribution,
			updated_at = now()`)
	defer stmt.Close()

	if _, err := pg.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return "", err
	}

	return token, nil
}

// ConfirmMailingListSignup subscribes the address the token was sent to. Each
// token works once.
func ConfirmMailingListSignup(ctx context.Context, pg *pgxpool.Pool, token string) error {
	stmt := sqlf.PostgreSQL.
		Select("email").
		Select("confirmation_expires_at").
		Select("confirmation_attribution").
		From("mailing_list_subscribers").
		Where("confirmation_token_hash = ?", hashMailingListToken(token))
	defer stmt.Close()

	var email, attribution string
	var expiresAt time.Time
	err := pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&email, &expiresAt, &attribution)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrMailingListTokenInvalid
	}
	if err != nil {
		return err
	}
	if time.Now().After(expiresAt) {
		return ErrMailingListTokenExpired
	}

	if err := resend.Subscribe(ctx, email, ""); err != nil {
		return fmt.Errorf("failed to subscribe mailing list contact: %w", err)
	}
	changed, err := saveMailingListChange(ctx, pg, email, true, attribution)
	if err != nil {
		return err
	}
	if changed {
		fireMailingListEvent(mailingListUserID(ctx, pg, email), email, true, attribution)
	}

	return nil
}

// RecordMailingListUnsubscribe records an unsubscribe made through the link in
// a mailing list email. Addresses that are not subscribed are ignored.
func RecordMailingListUnsubscribe(ctx context.Context, pg *pgxpool.Pool, email string) error {
	email = strings.ToLower(email)

	stmt := sqlf.PostgreSQL.
		Select("subscribed").
		From("mailing_list_subscribers").
		Where("email = ?", email)
	defer stmt.Close()

	var subscribed bool
	err := pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&subscribed)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if !subscribed {
		return nil
	}

	changed, err := saveMailingListChange(ctx, pg, email, false, MailingListAttributionUnsubscribeLink)
	if err != nil {
		return err
	}
	if changed {
		fireMailingListEvent(mailingListUserID(ctx, pg, email), email, false, MailingListAttributionUnsubscribeLink)
	}
	return nil
}

// mailingListUserID returns the id of the user with this address, or an
// empty string if there is none.
func mailingListUserID(ctx context.Context, pg *pgxpool.Pool, email string) string {
	stmt := sqlf.PostgreSQL.
		Select("id::text").
		From("users").
		Where("lower(email) = ?", email).
		Limit(1)
	defer stmt.Close()

	var userID string
	if err := pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&userID); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		log.Printf("mailing list: look up user for subscriber: %v", err)
	}
	return userID
}

func hashMailingListToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
