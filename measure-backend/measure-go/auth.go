package main

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt"
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

func validateAccessToken() gin.HandlerFunc {
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

		accessToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				err := fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				return nil, err
			}

			return []byte(server.config.authJWTSecret), nil
		})

		if err != nil {
			msg := fmt.Sprintf("failed to parse access token: %v", err)
			fmt.Println(msg)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		if claims, ok := accessToken.Claims.(jwt.MapClaims); ok {
			fmt.Println("jwt claims", claims)
			userId := claims["sub"]
			c.Set("userId", userId)
		} else {
			msg := "Failed to read claims from parsed access token"
			fmt.Println(msg, err)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		c.Next()
	}
}
