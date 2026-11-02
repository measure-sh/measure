package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"strings"

	"backend/libs/email"
	"backend/libs/measure"
	"backend/libs/turnstile"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type mailingListPrefsPayload struct {
	ListID      string `json:"list_id" binding:"required"`
	Subscribed  *bool  `json:"subscribed" binding:"required"`
	Attribution string `json:"attribution" binding:"required"`
}

type mailingListSubscribePayload struct {
	Email          string `json:"email"`
	ListID         string `json:"list_id"`
	Attribution    string `json:"attribution"`
	TurnstileToken string `json:"turnstile_token"`
}

type mailingListConfirmPayload struct {
	Token string `json:"token" binding:"required"`
}

type mailingListUnsubscribePayload struct {
	SubscriberID string `json:"id"`
	Sig          string `json:"sig"`
	ListID       string `json:"list_id"`
}

const (
	mailingListNotEnabled = "mailing list is not enabled"
	unknownMailingList    = "list_id is not a known mailing list"

	// unsubscribeLinkInvalid is shown for any link that fails the signature
	// check, so a bad link reveals nothing about the subscriber.
	unsubscribeLinkInvalid = "This unsubscribe link is invalid."
)

// sendEmail is a variable so tests can replace it.
var sendEmail = email.SendEmail

// mailingListConfigured reports whether the unsubscribe key is set. Every
// mailing list endpoint is off without it, because nobody could unsubscribe
// from a mailing list email.
func (h Handlers) mailingListConfigured() bool {
	return h.Deps.Config.MailingListUnsubscribeKey != ""
}

func mailingListUnavailable(c *gin.Context, err error) {
	fmt.Println("mailing list request failed:", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Something went wrong. Please try again later."})
}

func (h Handlers) GetMailingListPrefs(c *gin.Context) {
	deps := h.Deps
	userIdString := c.GetString("userId")

	userId, err := uuid.Parse(userIdString)
	if err != nil {
		fmt.Println("Error parsing userId:", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "user id invalid or missing",
		})
		return
	}

	lists, err := measure.MailingListSubscriptions(c.Request.Context(), deps.PgPool, userId)
	if err != nil {
		msg := `unable to fetch mailing list prefs`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"enabled": h.mailingListConfigured(),
		"lists":   lists,
	})
}

func (h Handlers) UpdateMailingListPrefs(c *gin.Context) {
	deps := h.Deps
	if !h.mailingListConfigured() {
		c.JSON(http.StatusNotFound, gin.H{
			"error": mailingListNotEnabled,
		})
		return
	}

	userIdString := c.GetString("userId")

	userId, err := uuid.Parse(userIdString)
	if err != nil {
		fmt.Println("Error parsing userId:", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "user id invalid or missing",
		})
		return
	}

	var payload mailingListPrefsPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `list_id, subscribed and attribution are required`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}
	if !measure.IsMailingList(payload.ListID) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": unknownMailingList,
		})
		return
	}

	if err := measure.SetMailingListSubscription(c.Request.Context(), deps.PgPool, userId, payload.ListID, *payload.Subscribed, payload.Attribution); err != nil {
		msg := `failed to update mailing list prefs`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": "done",
	})
}

// SubscribeMailingList emails a confirmation link to the address. It responds
// the same way whether or not the address is already subscribed.
func (h Handlers) SubscribeMailingList(c *gin.Context) {
	deps := h.Deps
	if !h.mailingListConfigured() || !turnstile.Enabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": mailingListNotEnabled})
		return
	}

	var payload mailingListSubscribePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter a valid email address"})
		return
	}

	// Only a bare address like a@b.co, without a display name.
	input := strings.TrimSpace(payload.Email)
	addr, err := mail.ParseAddress(input)
	if len(input) > 254 || err != nil || addr.Name != "" || addr.Address != input || !strings.Contains(addr.Address, ".") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter a valid email address"})
		return
	}
	address := strings.ToLower(addr.Address)

	if !measure.IsMailingList(payload.ListID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": unknownMailingList})
		return
	}

	attribution := strings.TrimSpace(payload.Attribution)
	if attribution == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "attribution is required"})
		return
	}

	ctx := c.Request.Context()

	passed, err := turnstile.Verify(ctx, payload.TurnstileToken)
	if err != nil {
		mailingListUnavailable(c, err)
		return
	}
	if !passed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "We couldn't verify you're human. Please try again."})
		return
	}

	token, err := measure.RequestMailingListSignup(ctx, deps.PgPool, address, payload.ListID, attribution)
	if err != nil {
		mailingListUnavailable(c, err)
		return
	}

	subject, body := email.MailingListConfirmEmail(deps.Config.SiteOrigin, token)
	if err := sendEmail(deps.Mail, email.EmailInfo{
		From:        deps.Config.TxEmailAddress,
		To:          address,
		Subject:     subject,
		ContentType: "text/html",
		Body:        body,
	}); err != nil {
		mailingListUnavailable(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "Check your inbox to confirm your subscription."})
}

func (h Handlers) ConfirmMailingList(c *gin.Context) {
	deps := h.Deps
	if !h.mailingListConfigured() {
		c.JSON(http.StatusNotFound, gin.H{"error": mailingListNotEnabled})
		return
	}

	var payload mailingListConfirmPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This confirmation link is invalid or has already been used."})
		return
	}

	err := measure.ConfirmMailingListSignup(c.Request.Context(), deps.PgPool, payload.Token)
	switch {
	case errors.Is(err, measure.ErrMailingListTokenInvalid):
		c.JSON(http.StatusBadRequest, gin.H{"error": "This confirmation link is invalid or has already been used."})
		return
	case errors.Is(err, measure.ErrMailingListTokenExpired):
		c.JSON(http.StatusBadRequest, gin.H{"error": "This confirmation link has expired. Please subscribe again."})
		return
	case err != nil:
		mailingListUnavailable(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "You're subscribed."})
}

// GetMailingListLinkSubscriptions returns the lists of the subscriber an
// unsubscribe link was sent to, for the unsubscribe page.
func (h Handlers) GetMailingListLinkSubscriptions(c *gin.Context) {
	deps := h.Deps
	if !h.mailingListConfigured() {
		c.JSON(http.StatusNotFound, gin.H{"error": mailingListNotEnabled})
		return
	}

	lists, err := measure.MailingListLinkSubscriptions(c.Request.Context(), deps.PgPool, deps.Config.MailingListUnsubscribeKey, c.Query("id"), c.Query("sig"))
	switch {
	case errors.Is(err, measure.ErrMailingListLinkInvalid):
		c.JSON(http.StatusBadRequest, gin.H{"error": unsubscribeLinkInvalid})
		return
	case err != nil:
		mailingListUnavailable(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"lists": lists})
}

// RedirectMailingListUnsubscribe sends a browser that opens the unsubscribe
// header's address to the unsubscribe page.
func (h Handlers) RedirectMailingListUnsubscribe(c *gin.Context) {
	deps := h.Deps
	if !h.mailingListConfigured() {
		c.JSON(http.StatusNotFound, gin.H{"error": mailingListNotEnabled})
		return
	}

	c.Redirect(http.StatusFound, deps.Config.SiteOrigin+"/unsubscribe?"+c.Request.URL.RawQuery)
}

// UnsubscribeMailingList unsubscribes the subscriber of a signed link from a
// list. The unsubscribe page sends the link's values as JSON. Inbox providers
// send a one-click unsubscribe (RFC 8058) as a form POST to the address in
// the email's List-Unsubscribe header, with the values in its query, and get
// an empty response.
func (h Handlers) UnsubscribeMailingList(c *gin.Context) {
	deps := h.Deps
	if !h.mailingListConfigured() {
		c.JSON(http.StatusNotFound, gin.H{"error": mailingListNotEnabled})
		return
	}

	oneClick := c.Query("id") != ""
	payload := mailingListUnsubscribePayload{
		SubscriberID: c.Query("id"),
		Sig:          c.Query("sig"),
		ListID:       c.Query("list"),
	}
	if !oneClick {
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": unsubscribeLinkInvalid})
			return
		}
	}

	err := measure.UnsubscribeMailingListLink(c.Request.Context(), deps.PgPool, deps.Config.MailingListUnsubscribeKey, payload.SubscriberID, payload.Sig, payload.ListID)
	switch {
	case errors.Is(err, measure.ErrMailingListLinkInvalid):
		c.JSON(http.StatusBadRequest, gin.H{"error": unsubscribeLinkInvalid})
		return
	case err != nil:
		mailingListUnavailable(c, err)
		return
	}

	if oneClick {
		c.Status(http.StatusOK)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": "You're unsubscribed."})
}
