package handlers

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"backend/libs/email"
	"backend/libs/measure"
	"backend/libs/resend"

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

// Daily limits on mailing list signup requests, per client IP, per email
// address and overall.
var mailingListLimits = struct {
	perIP, perEmail, total int64
}{perIP: 5, perEmail: 5, total: 500}

// Headers the dashboard proxy on Vercel adds to every API request. The
// client IP is only trusted on requests that carry the proxy secret.
const (
	dashboardProxySecretHeader = "X-Measure-Proxy-Secret"
	dashboardClientIPHeader    = "X-Measure-Client-IP"
)

type mailingListSubscribePayload struct {
	Email       string `json:"email"`
	Attribution string `json:"attribution"`
}

type mailingListConfirmPayload struct {
	Token string `json:"token" binding:"required"`
}

// mailingListRequestAllowed answers the request and returns false when
// mailing list signups are not set up, as on self-hosted installs, or when the
// request did not come through the dashboard proxy.
func mailingListRequestAllowed(h Handlers, c *gin.Context) bool {
	cfg := h.Deps.Config
	if !resend.Enabled() || cfg.DashboardProxySecret == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "mailing list signups are not enabled"})
		return false
	}

	got := c.GetHeader(dashboardProxySecretHeader)
	if subtle.ConstantTimeCompare([]byte(got), []byte(cfg.DashboardProxySecret)) != 1 {
		c.JSON(http.StatusForbidden, gin.H{"error": "mailing list requests must come through the dashboard"})
		return false
	}
	return true
}

// SubscribeMailingList emails a confirmation link to the address. It answers
// the same whether or not the address is already subscribed, so the form
// does not reveal who is.
func (h Handlers) SubscribeMailingList(c *gin.Context) {
	deps := h.Deps
	if !mailingListRequestAllowed(h, c) {
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

	// Each check counts the request, so the narrowest goes first and a client
	// over its own limit does not use up the others. Keys hash the IP and
	// address so neither is stored in Valkey.
	hash := func(s string) string {
		sum := sha256.Sum256([]byte(s))
		return hex.EncodeToString(sum[:8])
	}
	day := fmt.Sprint(time.Now().Unix() / int64((24 * time.Hour).Seconds()))
	for _, limit := range []struct {
		key string
		max int64
	}{
		{"mailing_list:ip:" + hash(c.GetHeader(dashboardClientIPHeader)) + ":" + day, mailingListLimits.perIP},
		{"mailing_list:email:" + hash(address) + ":" + day, mailingListLimits.perEmail},
		{"mailing_list:total:" + day, mailingListLimits.total},
	} {
		count, err := deps.VK.Do(ctx, deps.VK.B().Incr().Key(limit.key).Build()).AsInt64()
		if err != nil {
			mailingListUnavailable(c, err)
			return
		}
		if count == 1 {
			if err := deps.VK.Do(ctx, deps.VK.B().Expire().Key(limit.key).Seconds(int64((24 * time.Hour).Seconds())).Build()).Error(); err != nil {
				mailingListUnavailable(c, err)
				return
			}
		}
		if count > limit.max {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many attempts. Please try again tomorrow."})
			return
		}
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
	if !mailingListRequestAllowed(h, c) {
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

func mailingListUnavailable(c *gin.Context, err error) {
	fmt.Println("mailing list signup failed:", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Something went wrong. Please try again later."})
}
