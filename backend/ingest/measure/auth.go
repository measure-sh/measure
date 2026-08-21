package measure

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// extractToken extracts the access token
// from the cookie or Authorization header.
func extractToken(c *gin.Context) (token string) {
	// Try cookie first
	token, err := c.Cookie("access_token")
	if err == nil && token != "" {
		return token
	}

	// Fallback to Authorization header for API clients
	authHeader := c.GetHeader("Authorization")
	splitToken := strings.Split(authHeader, "Bearer ")

	if len(splitToken) != 2 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	token = strings.TrimSpace(splitToken[1])

	if token == "" {
		c.AbortWithStatus((http.StatusUnauthorized))
		return
	}

	return
}

// ValidateAPIKey validates the Measure API key.
func ValidateAPIKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := extractToken(c)

		appId, err := DecodeAPIKey(c, key)
		if err != nil {
			fmt.Println("api key decode failed:", err)
			if errors.Is(err, ErrInvalidAPIKey) {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid api key"})
				return
			}
			// lookup failures are infrastructure, a 401 would make SDKs discard
			// the batch instead of retrying.
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to validate api key"})
			return
		}

		if appId == nil {
			msg := "no app found for this api key"
			fmt.Println(msg)
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": msg})
			return
		}

		c.Set("appId", appId.String())

		c.Next()
	}
}
