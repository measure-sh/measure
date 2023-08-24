package main

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func authorize() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader(("Authorization"))
		splitToken := strings.Split(authHeader, "Bearer ")
		if len(splitToken) != 2 {
			// Authorization header is not in the correct format
			c.AbortWithStatus((http.StatusUnauthorized))
			return
		}

		token := strings.TrimSpace(splitToken[1])

		if token == "" {
			c.AbortWithStatus((http.StatusUnauthorized))
			return
		}

		c.Set("token", token)

		c.Next()
	}
}
