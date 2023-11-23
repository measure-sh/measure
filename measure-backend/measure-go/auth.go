package main

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
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

			return []byte(server.Config.AuthJWTSecret), nil
		})

		if err != nil {
			if errors.Is(err, jwt.ErrTokenExpired) {
				msg := "access token has expired"
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": msg})
				return
			}

			fmt.Println("generic access token error", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or malformed access token"})
		}

		if claims, ok := accessToken.Claims.(jwt.MapClaims); ok {
			userId := claims["sub"]
			c.Set("userId", userId)
		} else {
			msg := "failed to read claims from access token"
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": msg})
			return
		}

		c.Next()
	}
}
