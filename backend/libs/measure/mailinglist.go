package measure

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// MailingList is a list of emails people can subscribe to.
type MailingList struct {
	ID   string `json:"list_id"`
	Name string `json:"name"`
}

// MailingListSubscription is whether an address is subscribed to a list.
type MailingListSubscription struct {
	MailingList
	Subscribed bool `json:"subscribed"`
}

const (
	// MailingListNewsletter is the id of the Measure newsletter.
	MailingListNewsletter = "newsletter"

	// MailingListAttributionUnsubscribeLink is the attribution of an
	// unsubscribe through the link or the unsubscribe header in a mailing list
	// email.
	MailingListAttributionUnsubscribeLink = "unsubscribe_link"

	// MailingListConfirmationTTL is how long a confirmation link works.
	MailingListConfirmationTTL = 48 * time.Hour
)

// MailingLists are the lists people can subscribe to, in the order they are
// shown.
var MailingLists = []MailingList{
	{ID: MailingListNewsletter, Name: "Measure newsletter"},
}

var (
	ErrMailingListTokenInvalid = errors.New("mailing list confirmation link is invalid")
	ErrMailingListTokenExpired = errors.New("mailing list confirmation link has expired")
	ErrMailingListLinkInvalid  = errors.New("mailing list unsubscribe link is invalid")
)

// saveMailingListChange sets whether the address is subscribed to the list
// and records the change in its history. It reports whether the state
// changed; an unchanged state is not recorded.
func saveMailingListChange(ctx context.Context, pg *pgxpool.Pool, email, listID string, subscribed bool, attribution string) (bool, error) {
	tx, err := pg.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	// The upsert always updates the row, so it stays locked until the
	// transaction ends and two saves for the same address run one after the
	// other.
	subscriber := sqlf.PostgreSQL.InsertInto("mailing_list_subscribers").
		Set("email", email).
		Clause("on conflict (email) do update set updated_at = now()").
		Returning("id")
	defer subscriber.Close()

	var subscriberID string
	if err := tx.QueryRow(ctx, subscriber.String(), subscriber.Args()...).Scan(&subscriberID); err != nil {
		return false, err
	}

	if subscribed {
		clear := sqlf.PostgreSQL.Update("mailing_list_subscribers").
			Set("confirmation_token_hash", nil).
			Set("confirmation_expires_at", nil).
			Set("confirmation_list_id", nil).
			Set("confirmation_attribution", nil).
			Where("id = ?", subscriberID).
			Where("confirmation_list_id = ?", listID)
		defer clear.Close()

		if _, err := tx.Exec(ctx, clear.String(), clear.Args()...); err != nil {
			return false, err
		}
	}

	current := sqlf.PostgreSQL.
		Select("subscribed").
		From("mailing_list_subscriptions").
		Where("subscriber_id = ?", subscriberID).
		Where("list_id = ?", listID)
	defer current.Close()

	wasSubscribed := false
	err = tx.QueryRow(ctx, current.String(), current.Args()...).Scan(&wasSubscribed)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return false, err
	}

	upsert := sqlf.PostgreSQL.InsertInto("mailing_list_subscriptions").
		Set("subscriber_id", subscriberID).
		Set("list_id", listID).
		Set("subscribed", subscribed).
		Clause(`on conflict (subscriber_id, list_id) do update set
			subscribed = excluded.subscribed,
			updated_at = now()`)
	defer upsert.Close()

	if _, err := tx.Exec(ctx, upsert.String(), upsert.Args()...); err != nil {
		return false, err
	}

	if wasSubscribed == subscribed {
		return false, tx.Commit(ctx)
	}

	event := sqlf.PostgreSQL.InsertInto("mailing_list_subscribe_events").
		Set("subscriber_id", subscriberID).
		Set("list_id", listID).
		Set("subscribed", subscribed).
		Set("attribution", attribution)
	defer event.Close()

	if _, err := tx.Exec(ctx, event.String(), event.Args()...); err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

// mailingListSubscriptions returns every list with whether the subscriber is
// subscribed to it. A list the subscriber never joined is not subscribed.
func mailingListSubscriptions(ctx context.Context, pg *pgxpool.Pool, subscriberID string) ([]MailingListSubscription, error) {
	subscribed := map[string]bool{}
	if subscriberID != "" {
		stmt := sqlf.PostgreSQL.
			Select("list_id").
			Select("subscribed").
			From("mailing_list_subscriptions").
			Where("subscriber_id = ?", subscriberID)
		defer stmt.Close()

		rows, err := pg.Query(ctx, stmt.String(), stmt.Args()...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var listID string
			var isSubscribed bool
			if err := rows.Scan(&listID, &isSubscribed); err != nil {
				return nil, err
			}
			subscribed[listID] = isSubscribed
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
	}

	subscriptions := make([]MailingListSubscription, 0, len(MailingLists))
	for _, l := range MailingLists {
		subscriptions = append(subscriptions, MailingListSubscription{MailingList: l, Subscribed: subscribed[l.ID]})
	}
	return subscriptions, nil
}

// mailingListLinkEmail returns the address of a signed unsubscribe link's
// subscriber, or ErrMailingListLinkInvalid.
func mailingListLinkEmail(ctx context.Context, pg *pgxpool.Pool, key, subscriberID, sig string) (string, error) {
	id, err := uuid.Parse(subscriberID)
	// Anyone can sign a link with an empty key, so no link is valid without one.
	if err != nil || key == "" {
		return "", ErrMailingListLinkInvalid
	}
	if !hmac.Equal([]byte(SignMailingListUnsubscribe(key, id)), []byte(sig)) {
		return "", ErrMailingListLinkInvalid
	}

	stmt := sqlf.PostgreSQL.
		Select("email").
		From("mailing_list_subscribers").
		Where("id = ?", id)
	defer stmt.Close()

	var email string
	err = pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrMailingListLinkInvalid
	}
	return email, err
}

func hashMailingListToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// IsMailingList reports whether id is one of MailingLists.
func IsMailingList(id string) bool {
	for _, l := range MailingLists {
		if l.ID == id {
			return true
		}
	}
	return false
}

// MailingListSubscriptions returns every list with whether the user's address
// is subscribed to it.
func MailingListSubscriptions(ctx context.Context, pg *pgxpool.Pool, userId uuid.UUID) ([]MailingListSubscription, error) {
	stmt := sqlf.PostgreSQL.
		Select("coalesce(s.id::text, '')").
		From("users u").
		LeftJoin("mailing_list_subscribers s", "s.email = lower(u.email)").
		Where("u.id = ?", userId)
	defer stmt.Close()

	var subscriberID string
	if err := pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&subscriberID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("no user found with id %s", userId)
		}
		return nil, err
	}
	return mailingListSubscriptions(ctx, pg, subscriberID)
}

// SetMailingListSubscription subscribes the user's address to the list, or
// unsubscribes it.
func SetMailingListSubscription(ctx context.Context, pg *pgxpool.Pool, userId uuid.UUID, listID string, optIn bool, attribution string) error {
	user := &User{ID: new(string)}
	*user.ID = userId.String()
	if err := user.GetUserDetails(ctx, pg); err != nil {
		return err
	}
	email := strings.ToLower(*user.Email)

	changed, err := saveMailingListChange(ctx, pg, email, listID, optIn, attribution)
	if err != nil {
		return err
	}
	if changed {
		fireMailingListEvent(listID, optIn, attribution)
	}
	return nil
}

// RequestMailingListSignup stores a pending signup to the list and returns
// the confirmation token to email to the address. A new request replaces any
// earlier token.
func RequestMailingListSignup(ctx context.Context, pg *pgxpool.Pool, email, listID, attribution string) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(b)

	stmt := sqlf.PostgreSQL.InsertInto("mailing_list_subscribers").
		Set("email", strings.ToLower(email)).
		Set("confirmation_token_hash", hashMailingListToken(token)).
		Set("confirmation_expires_at", time.Now().Add(MailingListConfirmationTTL)).
		Set("confirmation_list_id", listID).
		Set("confirmation_attribution", attribution).
		Clause(`on conflict (email) do update set
			confirmation_token_hash = excluded.confirmation_token_hash,
			confirmation_expires_at = excluded.confirmation_expires_at,
			confirmation_list_id = excluded.confirmation_list_id,
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
		Select("confirmation_list_id").
		Select("confirmation_attribution").
		From("mailing_list_subscribers").
		Where("confirmation_token_hash = ?", hashMailingListToken(token))
	defer stmt.Close()

	var email, listID, attribution string
	var expiresAt time.Time
	err := pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&email, &expiresAt, &listID, &attribution)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrMailingListTokenInvalid
	}
	if err != nil {
		return err
	}
	if time.Now().After(expiresAt) {
		return ErrMailingListTokenExpired
	}

	changed, err := saveMailingListChange(ctx, pg, email, listID, true, attribution)
	if err != nil {
		return err
	}
	if changed {
		fireMailingListEvent(listID, true, attribution)
	}

	return nil
}

// SignMailingListUnsubscribe returns the signature for a subscriber's
// unsubscribe link. It covers the subscriber and not a list, so one link can
// manage all of the subscriber's lists. Nothing is stored: the link is checked
// by signing again with the same key.
func SignMailingListUnsubscribe(key string, subscriberID uuid.UUID) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte("unsubscribe:" + subscriberID.String()))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// MailingListLinkSubscriptions returns every list with whether the subscriber
// of a signed unsubscribe link is subscribed to it.
func MailingListLinkSubscriptions(ctx context.Context, pg *pgxpool.Pool, key, subscriberID, sig string) ([]MailingListSubscription, error) {
	if _, err := mailingListLinkEmail(ctx, pg, key, subscriberID, sig); err != nil {
		return nil, err
	}
	return mailingListSubscriptions(ctx, pg, subscriberID)
}

// UnsubscribeMailingListLink unsubscribes the subscriber of a signed
// unsubscribe link from the list.
func UnsubscribeMailingListLink(ctx context.Context, pg *pgxpool.Pool, key, subscriberID, sig, listID string) error {
	if !IsMailingList(listID) {
		return ErrMailingListLinkInvalid
	}
	email, err := mailingListLinkEmail(ctx, pg, key, subscriberID, sig)
	if err != nil {
		return err
	}

	changed, err := saveMailingListChange(ctx, pg, email, listID, false, MailingListAttributionUnsubscribeLink)
	if err != nil {
		return err
	}
	if changed {
		fireMailingListEvent(listID, false, MailingListAttributionUnsubscribeLink)
	}
	return nil
}
