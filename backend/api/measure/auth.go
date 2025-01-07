package measure

import (
	"backend/api/authsession"
	"backend/api/cipher"
	"backend/api/server"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"google.golang.org/api/idtoken"
)

// extractToken extracts the bearer token
// from authorization header.
func extractToken(c *gin.Context) (token string) {
	authHeader := c.GetHeader(("Authorization"))
	splitToken := strings.Split(authHeader, "Bearer ")

	if len(splitToken) != 2 {
		// Authorization header is not in the correct format
		c.AbortWithStatus((http.StatusUnauthorized))
		return
	}

	token = strings.TrimSpace(splitToken[1])

	if token == "" {
		c.AbortWithStatus((http.StatusUnauthorized))
		return
	}

	return
}

// logEmail logs email to std out
func logEmail(email string) {
	fmt.Println("Logged in user email: ", email)
}

// ValidateAPIKey validates the Measure API key.
func ValidateAPIKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := extractToken(c)

		appId, err := DecodeAPIKey(key)
		if err != nil {
			fmt.Println("api key decode failed:", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid api key"})
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

// ValidateAccessToken validates Measure access tokens.
func ValidateAccessToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)

		accessToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				err := fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				return nil, err
			}

			return server.Server.Config.AccessTokenSecret, nil
		})

		if err != nil {
			if errors.Is(err, jwt.ErrTokenExpired) {
				msg := "access token has expired"
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": msg,
				})
				return
			}

			fmt.Println("unknown token error", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or malformed access token",
			})
			return
		}

		if claims, ok := accessToken.Claims.(jwt.MapClaims); ok {
			userId := claims["sub"]
			c.Set("userId", userId)
		} else {
			msg := "failed to read claims from access token"
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": msg,
			})
			return
		}

		c.Next()
	}
}

// ValidateRefreshToken validates the Measure refresh token.
func ValidateRefreshToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)

		refreshToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				err := fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				return nil, err
			}

			return server.Server.Config.RefreshTokenSecret, nil
		})

		if err != nil {
			if errors.Is(err, jwt.ErrTokenExpired) {
				msg := "refresh token has expired"
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": msg,
				})
				return
			}

			fmt.Println("unknown token error:", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or malformed refresh token",
			})
			return
		}

		if claims, ok := refreshToken.Claims.(jwt.MapClaims); ok {
			jti := claims["jti"]
			c.Set("jti", jti.(string))
		} else {
			msg := "failed to read claims from refresh token"
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": msg,
			})
			return
		}

		c.Next()
	}
}

// SigninGitHub handles OAuth flow via GitHub.
func SigninGitHub(c *gin.Context) {
	ctx := c.Request.Context()

	type AuthCode struct {
		Type  string `json:"type" binding:"required"`
		State string `json:"state" binding:"required"`
		Code  string `json:"code"`
	}

	authCode := AuthCode{}

	msg := "failed to parse github auth payload"
	if err := c.ShouldBindJSON(&authCode); err != nil {
		fmt.Println(msg, err.Error())
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	if authCode.State == "" {
		fmt.Println(msg)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	switch authCode.Type {
	case "init":
		// process init
		authState := authsession.AuthState{
			OAuthProvider: "github",
			State:         authCode.State,
		}

		if err := authState.Save(ctx); err != nil {
			msg := "failed to authenticate via github oauth"
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok": "github oauth init ack",
		})
		return
	case "code":
		// process code
		if authCode.Code == "" {
			fmt.Println(msg)
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": msg,
			})
			return
		}

		msg := `failed to authenticate via github`

		authState, err := authsession.GetOAuthState(ctx, authCode.State, "github")
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		if authState.State != authCode.State {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": msg,
			})
			return
		}

		githubToken, err := authsession.ExchangeCodeForToken(authCode.Code)
		if err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		if err := authsession.RemoveOAuthState(ctx, authState.State, "github"); err != nil {
			fmt.Printf("failed to remove github oauth state: %q\n", authState.State)
		}

		ghUser, err := authsession.GetGitHubUser(githubToken.AccessToken)
		if err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		userMeta, err := json.Marshal(ghUser)
		if err != nil {
			return
		}

		msrUser, err := FindUserByEmail(ctx, ghUser.Email)
		if err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		if msrUser == nil {
			msrUser = NewUser(ghUser.Name, ghUser.Email)
			if err := msrUser.save(ctx, nil); err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}

			userName := msrUser.firstName()
			teamName := fmt.Sprintf("%s's team", userName)

			team := &Team{
				Name: &teamName,
			}

			tx, err := server.Server.PgPool.Begin(ctx)
			if err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}

			defer tx.Rollback(ctx)

			if err := team.create(ctx, msrUser, &tx); err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}

			if err := tx.Commit(ctx); err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}

			// Once new user creation is done, track email
			logEmail(ghUser.Email)
		} else {
			// update user's last sign in at value
			if err := msrUser.touchLastSignInAt(ctx); err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}
		}

		// FIXME: Change User struct's ID field to UUID
		// so that these kinds of convertion is not needed.
		userId := uuid.MustParse(*msrUser.ID)

		team, err := msrUser.getOwnTeam(ctx)
		if err != nil {
			msg := "failed to lookup user's team"
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		authSess, err := authsession.NewAuthSession(userId, *team.ID, "github", userMeta)
		if err != nil {
			return
		}

		if err = authSess.Save(ctx, nil); err != nil {
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"access_token":  authSess.AccessToken,
			"refresh_token": authSess.RefreshToken,
			"state":         authCode.State,
		})

		// deliberately ignore the error, because
		// expired sessions may get cleared eventually
		authsession.Cleanup(ctx)

		return
	default:
		fmt.Println(msg)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}
}

// SigninGoogle handles OAuth flow via Google.
func SigninGoogle(c *gin.Context) {
	ctx := c.Request.Context()
	type authstate struct {
		Credential string `json:"credential"`
		State      string `json:"state"`
		Nonce      string `json:"nonce"`
	}

	var authState authstate
	msg := "failed to sign in via google"
	if err := c.ShouldBindJSON(&authState); err != nil {
		fmt.Println(msg, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if authState.Credential == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": "missing credentials",
		})
		return
	}

	if authState.Nonce == "" && authState.State != "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": "missing nonce parameter",
		})
		return
	}

	if authState.State == "" && authState.Nonce != "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": "missing state parameter",
		})
		return
	}

	payload, err := idtoken.Validate(ctx, authState.Credential, server.Server.Config.OAuthGoogleKey)
	if err != nil {
		msg := "failed to validate google credentials"
		fmt.Println(msg, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	// Validate nonce if present
	//
	// Google API JavaScript client has an open issue where
	// it does not send nonce or state in its authorization
	// callback
	// See: https://github.com/google/google-api-javascript-client/issues/843
	//
	// If nonce and state, both are  empty, we consider it
	// valid and proceed for now.
	if authState.Nonce != "" {
		checksum, err := cipher.ComputeSHA2Hash([]byte(authState.Nonce))
		if err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		if payload.Claims["nonce"] != *checksum {
			msg := "failed to validate nonce"
			fmt.Println(msg)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
	}

	googUser := authsession.GoogleUser{
		ID:    payload.Subject,
		Name:  payload.Claims["name"].(string),
		Email: payload.Claims["email"].(string),
	}

	userMeta, err := json.Marshal(googUser)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	msrUser, err := FindUserByEmail(ctx, googUser.Email)
	if err != nil {
		fmt.Println(msg, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if msrUser == nil {
		msrUser = NewUser(googUser.Name, googUser.Email)
		if err := msrUser.save(ctx, nil); err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		userName := msrUser.firstName()
		teamName := fmt.Sprintf("%s's team", userName)

		team := &Team{
			Name: &teamName,
		}

		tx, err := server.Server.PgPool.Begin(ctx)
		if err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		defer tx.Rollback(ctx)

		if err := team.create(ctx, msrUser, &tx); err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		if err := tx.Commit(ctx); err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		// Once new user creation is done, track email
		logEmail(googUser.Email)
	} else {
		// update user's last sign in at value
		if err := msrUser.touchLastSignInAt(ctx); err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
	}

	// FIXME: Change User struct's ID field to UUID
	// so that these kinds of convertion is not needed.
	userId := uuid.MustParse(*msrUser.ID)

	team, err := msrUser.getOwnTeam(ctx)
	if err != nil {
		msg := "failed to lookup user's team"
		fmt.Println(msg, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	authSess, err := authsession.NewAuthSession(userId, *team.ID, "google", userMeta)
	if err != nil {
		return
	}

	if err = authSess.Save(ctx, nil); err != nil {
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  authSess.AccessToken,
		"refresh_token": authSess.RefreshToken,
		"state":         authState.State,
	})

	// deliberately ignore the error, because
	// expired sessions may get cleared eventually
	authsession.Cleanup(ctx)
}

// RefreshToken refreshes a previous session from
// its refresh token.
func RefreshToken(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.GetString("jti")

	jti, err := uuid.Parse(id)
	if err != nil {
		msg := "failed to parse refresh token"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	oldSession, err := authsession.GetAuthSession(ctx, jti)
	if errors.Is(err, pgx.ErrNoRows) {
		msg := "could not verify authenticity of the refresh token"
		fmt.Println(msg, err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": msg,
		})
		return
	}

	msg := `failed to refresh session`

	tx, err := server.Server.PgPool.Begin(ctx)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	defer tx.Rollback(ctx)

	userId := oldSession.UserID.String()

	user := User{ID: &userId}
	team, err := user.getOwnTeam(ctx)
	if err != nil {
		msg := "failed to lookup user's team"
		fmt.Println(msg, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	newSession, err := authsession.NewAuthSession(oldSession.UserID, *team.ID, oldSession.OAuthProvider, oldSession.UserMeta)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err = authsession.RemoveSession(ctx, jti, &tx); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err = newSession.Save(ctx, &tx); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err = tx.Commit(ctx); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  newSession.AccessToken,
		"refresh_token": newSession.RefreshToken,
	})
}

// Signout removes the active session associated to
// the refresh token.
func Signout(c *gin.Context) {
	ctx := c.Request.Context()

	id := c.GetString("jti")

	jti, err := uuid.Parse(id)
	if err != nil {
		msg := "failed to parse refresh token"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := authsession.RemoveSession(ctx, jti, nil); err != nil {
		msg := "failed to signout"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.Status(http.StatusOK)
}
