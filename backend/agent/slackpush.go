package main

import (
	"encoding/base64"
	"log"
	"net/http"
	"strings"

	"backend/agent/agent"

	"github.com/gin-gonic/gin"
	"google.golang.org/api/idtoken"
)

// pushEnvelope is the JSON body of a pushed message. Only the base64 data is
// needed; the event's fields live inside the decoded payload.
type pushEnvelope struct {
	Message struct {
		Data string `json:"data"`
	} `json:"message"`
}

// slackPushHandler serves Slack events delivered over HTTP, the counterpart to
// the pull consumer. It verifies the request token, caps concurrent turns &
// runs the turn synchronously so the response reflects its outcome. audience is
// the token audience the caller must present.
func slackPushHandler(agentConfig *agent.Config, audience string) gin.HandlerFunc {
	// Counting semaphore: a full channel means the turn cap is reached.
	sem := make(chan struct{}, maxConcurrentSlackTurns)
	expectedEmail := agentConfig.Deps.Config.ServiceAccountEmail

	return func(c *gin.Context) {
		if !verifyPushToken(c, audience, expectedEmail) {
			return
		}

		// At capacity: ask the caller to retry later instead of running more
		// turns than the cap allows.
		select {
		case sem <- struct{}{}:
			defer func() { <-sem }()
		default:
			c.Status(http.StatusTooManyRequests)
			return
		}

		var env pushEnvelope
		if err := c.BindJSON(&env); err != nil {
			// Malformed input never succeeds on retry; drop it with 200.
			log.Printf("agent: dropping slack push with bad envelope: %v", err)
			c.Status(http.StatusOK)
			return
		}

		data, err := base64.StdEncoding.DecodeString(env.Message.Data)
		if err != nil {
			log.Printf("agent: dropping slack push with bad base64: %v", err)
			c.Status(http.StatusOK)
			return
		}

		// Run the turn on the request context. A non-nil error, including a
		// cancelled request, returns 5xx so the caller retries; nil returns 200.
		if err := agentConfig.HandleSlackEvent(c.Request.Context(), data); err != nil {
			log.Printf("agent: slack push turn did not complete: %v", err)
			c.Status(http.StatusInternalServerError)
			return
		}

		c.Status(http.StatusOK)
	}
}

// verifyPushToken checks the signed bearer token on the request: signature,
// the expected audience & when set the expected email claim. It writes
// 401/403 & returns false on failure.
func verifyPushToken(c *gin.Context, audience, expectedEmail string) bool {
	authz := c.GetHeader("Authorization")
	token, ok := strings.CutPrefix(authz, "Bearer ")
	if !ok || token == "" {
		c.Status(http.StatusUnauthorized)
		return false
	}

	payload, err := idtoken.Validate(c.Request.Context(), token, audience)
	if err != nil {
		log.Printf("agent: slack push token rejected: %v", err)
		c.Status(http.StatusUnauthorized)
		return false
	}

	if expectedEmail != "" {
		if email, _ := payload.Claims["email"].(string); email != expectedEmail {
			log.Printf("agent: slack push token from unexpected principal %q", email)
			c.Status(http.StatusForbidden)
			return false
		}
	}

	return true
}
