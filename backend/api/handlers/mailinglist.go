package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/mail"
	"strings"

	"backend/libs/email"
	"backend/libs/measure"
	"backend/libs/resend"
	"backend/libs/turnstile"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type mailingListPrefsPayload struct {
	Subscribed  *bool  `json:"subscribed" binding:"required"`
	Attribution string `json:"attribution" binding:"required"`
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

	subscribed, err := measure.MailingListSubscribed(c.Request.Context(), deps.PgPool, userId)
	if err != nil {
		msg := `unable to fetch mailing list prefs`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	// enabled is false without Resend, as on self-hosted installs.
	c.JSON(http.StatusOK, gin.H{
		"enabled":    resend.Enabled(),
		"subscribed": subscribed,
	})
}

func (h Handlers) UpdateMailingListPrefs(c *gin.Context) {
	deps := h.Deps
	if !resend.Enabled() {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "mailing list is not enabled",
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
		msg := `subscribed and attribution are required`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	if err := measure.SetMailingListSubscription(c.Request.Context(), deps.PgPool, userId, *payload.Subscribed, payload.Attribution); err != nil {
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

// sendEmail is a variable so tests can replace it and never send mail.
var sendEmail = email.SendEmail

type mailingListSubscribePayload struct {
	Email          string `json:"email"`
	Attribution    string `json:"attribution"`
	TurnstileToken string `json:"turnstile_token"`
}

type mailingListConfirmPayload struct {
	Token string `json:"token" binding:"required"`
}

// SubscribeMailingList emails a confirmation link to the address. It answers
// the same whether or not the address is already subscribed, so the form
// does not reveal who is.
func (h Handlers) SubscribeMailingList(c *gin.Context) {
	deps := h.Deps
	if !resend.Enabled() || !turnstile.Enabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "mailing list signups are not enabled"})
		return
	}

	var payload mailingListSubscribePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter a valid email address."})
		return
	}

	// Accept one bare address, like a@b.co, and nothing else.
	input := strings.TrimSpace(payload.Email)
	addr, err := mail.ParseAddress(input)
	if len(input) > 254 || err != nil || addr.Name != "" || addr.Address != input || !strings.Contains(addr.Address, ".") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter a valid email address."})
		return
	}
	address := strings.ToLower(addr.Address)

	attribution := strings.TrimSpace(payload.Attribution)
	if attribution == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "attribution is required"})
		return
	}

	ctx := c.Request.Context()

	// Each token works once, so a script has to pass a new check for every
	// confirmation email it wants sent.
	passed, err := turnstile.Verify(ctx, payload.TurnstileToken)
	if err != nil {
		mailingListUnavailable(c, err)
		return
	}
	if !passed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "We couldn't verify you're human. Please try again."})
		return
	}

	token, err := measure.RequestMailingListSignup(ctx, deps.PgPool, address, attribution)
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
	if !resend.Enabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "mailing list signups are not enabled"})
		return
	}

	var payload mailingListConfirmPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This confirmation link is invalid or has already been used."})
		return
	}

	err := measure.ConfirmMailingListSignup(c.Request.Context(), h.Deps.PgPool, payload.Token)
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

// HandleResendWebhook records unsubscribes made through the link in a mailing
// list email. Resend handles that link itself, so this webhook is how we hear
// about them.
func (h Handlers) HandleResendWebhook(c *gin.Context) {
	deps := h.Deps
	secret := deps.Config.ResendWebhookSecret
	if !resend.Enabled() || secret == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "mailing list webhooks are not enabled"})
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	ev, err := resend.VerifyWebhook(c.Request.Header, payload, secret)
	if err != nil {
		log.Println("resend webhook verification failed:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}

	if ev.Type == resend.EventContactUpdated {
		var data resend.ContactData
		if err := json.Unmarshal(ev.Data, &data); err != nil {
			log.Println("failed to parse contact.updated:", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid contact data"})
			return
		}
		if data.Unsubscribed {
			// A 500 makes Resend retry the delivery.
			if err := measure.RecordMailingListUnsubscribe(c.Request.Context(), deps.PgPool, data.Email); err != nil {
				log.Println("failed to record mailing list unsubscribe:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to record unsubscribe"})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"received": true})
}

func mailingListUnavailable(c *gin.Context, err error) {
	fmt.Println("mailing list signup failed:", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Something went wrong. Please try again later."})
}
