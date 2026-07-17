package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend/libs/authsession"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

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

// extractRefreshToken extracts the refresh token
// from the cookie or Authorization header
func extractRefreshToken(c *gin.Context) (token string) {
	// Try cookie first
	token, err := c.Cookie("refresh_token")
	if err == nil && token != "" {
		return token
	}

	// Fallback to Authorization header
	return extractToken(c)
}

// ValidateAPIKey validates the Measure API key.
func (h Handlers) ValidateAPIKey() gin.HandlerFunc {
	deps := h.Deps
	return func(c *gin.Context) {
		key := extractToken(c)

		appId, err := measure.DecodeAPIKey(c, deps.PgPool, key)
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
func (h Handlers) ValidateAccessToken() gin.HandlerFunc {
	deps := h.Deps
	return func(c *gin.Context) {
		token := extractToken(c)

		accessToken, err := jwt.Parse(token, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				err := fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				return nil, err
			}

			return deps.Config.AccessTokenSecret, nil
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

			fmt.Println("unknown access token error: ", err)

			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or malformed access token",
			})
			return
		}

		if claims, ok := accessToken.Claims.(jwt.MapClaims); ok {
			sessionId := claims["jti"]
			c.Set("sessionId", sessionId)

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
func (h Handlers) ValidateRefreshToken() gin.HandlerFunc {
	deps := h.Deps
	return func(c *gin.Context) {
		token := extractRefreshToken(c)

		refreshToken, err := jwt.Parse(token, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				err := fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				return nil, err
			}

			return deps.Config.RefreshTokenSecret, nil
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

			fmt.Println("unknown refresh token error: ", err)

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

// AddNewUserToInvitedTeams adds a new user to the teams
// they were invited to and removes the invites after the addition.
//
// This is called when a new user is created via OAuth flow.
func (h Handlers) SigninGitHub(c *gin.Context) {
	deps := h.Deps
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

		if err := authState.Save(ctx, deps.PgPool); err != nil {
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

		authState, err := authsession.GetOAuthState(ctx, deps.PgPool, authCode.State, "github")
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

		gaClientID := c.Query("ga_client_id")
		gclid := c.Query("gclid")

		githubToken, err := authsession.ExchangeCodeForToken(deps.Config.SiteOrigin, deps.Config.OAuthGitHubKey, deps.Config.OAuthGitHubSecret, authCode.Code)
		if err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		if err := authsession.RemoveOAuthState(ctx, deps.PgPool, authState.State, "github"); err != nil {
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

		msrUser, err := measure.FindUserByEmail(ctx, deps.PgPool, ghUser.Email)
		if err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		var team *measure.Team

		if msrUser == nil {
			msrUser = measure.NewUser(ghUser.Name, ghUser.Email)
			if err := msrUser.Save(ctx, deps.PgPool, nil); err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}

			if err := measure.SaveUserAttribution(ctx, deps.PgPool, *msrUser.ID, gaClientID, gclid); err != nil {
				fmt.Println("failed to save user attribution:", err)
			}

			measure.FireSignupEvent(ctx, msrUser, "github", gaClientID)

			if err := measure.CreateNotifPref(deps.PgPool, uuid.MustParse(*msrUser.ID)); err != nil {
				fmt.Println("failed to create notif prefs", err)
			}

			team, err = measure.CreatePersonalTeam(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), msrUser)
			if err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}

			if err := measure.AddNewUserToInvitedTeams(ctx, deps.PgPool, *msrUser.ID, ghUser.Email); err != nil {
				// If there is an error while adding user to invited team,
				// log and continue. We don't want to fail sign in process
				// because of this.
				fmt.Println(msg, err)
			}
		} else {
			// update user's last sign in at value
			if err := msrUser.TouchLastSignInAt(ctx, deps.PgPool); err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}

			team, err = measure.EnsureDefaultTeam(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), msrUser)
			if err != nil {
				msg := "failed to lookup user's team"
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

		authSess, err := authsession.NewAuthSession(deps.Config.AccessTokenSecret, deps.Config.RefreshTokenSecret, userId, "github", userMeta)
		if err != nil {
			return
		}

		if err = authSess.Save(ctx, deps.PgPool, nil); err != nil {
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"access_token":  authSess.AccessToken,
			"refresh_token": authSess.RefreshToken,
			"session_id":    authSess.ID,
			"user_id":       userId,
			"own_team_id":   team.ID,
		})

		return
	default:
		fmt.Println(msg)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}
}

func (h Handlers) SigninGoogle(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()

	type AuthCode struct {
		Type  string `json:"type" binding:"required"`
		State string `json:"state" binding:"required"`
		Code  string `json:"code"`
	}

	authCode := AuthCode{}

	msg := "failed to parse google auth payload"
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
			OAuthProvider: "google",
			State:         authCode.State,
		}

		if err := authState.Save(ctx, deps.PgPool); err != nil {
			msg := "failed to authenticate via google oauth"
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok": "google oauth init ack",
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

		msg := `failed to authenticate via google`

		authState, err := authsession.GetOAuthState(ctx, deps.PgPool, authCode.State, "google")
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

		gaClientID := c.Query("ga_client_id")
		gclid := c.Query("gclid")

		redirectURI := fmt.Sprintf("%s/auth/callback/google", deps.Config.SiteOrigin)
		_, idToken, err := authsession.ExchangeGoogleCode(
			authCode.Code,
			redirectURI,
			deps.Config.OAuthGoogleKey,
			deps.Config.OAuthGoogleSecret,
		)
		if err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		if err := authsession.RemoveOAuthState(ctx, deps.PgPool, authState.State, "google"); err != nil {
			fmt.Printf("failed to remove google oauth state: %q\n", authState.State)
		}

		claims, err := authsession.DecodeGoogleIDToken(idToken)
		if err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		googUser := authsession.GoogleUser{
			Name:    claims.Name,
			Email:   claims.Email,
			Picture: claims.Picture,
		}

		userMeta, err := json.Marshal(googUser)
		if err != nil {
			return
		}

		msrUser, err := measure.FindUserByEmail(ctx, deps.PgPool, googUser.Email)
		if err != nil {
			fmt.Println(msg, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		var team *measure.Team

		if msrUser == nil {
			msrUser = measure.NewUser(googUser.Name, googUser.Email)
			if err := msrUser.Save(ctx, deps.PgPool, nil); err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}

			if err := measure.SaveUserAttribution(ctx, deps.PgPool, *msrUser.ID, gaClientID, gclid); err != nil {
				fmt.Println("failed to save user attribution:", err)
			}

			measure.FireSignupEvent(ctx, msrUser, "google", gaClientID)

			if err := measure.CreateNotifPref(deps.PgPool, uuid.MustParse(*msrUser.ID)); err != nil {
				fmt.Println("failed to create notif prefs", err)
			}

			team, err = measure.CreatePersonalTeam(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), msrUser)
			if err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}

			if err := measure.AddNewUserToInvitedTeams(ctx, deps.PgPool, *msrUser.ID, googUser.Email); err != nil {
				// If there is an error while adding user to invited team,
				// log and continue. We don't want to fail sign in process
				// because of this.
				fmt.Println(msg, err)
			}
		} else {
			// update user's last sign in at value
			if err := msrUser.TouchLastSignInAt(ctx, deps.PgPool); err != nil {
				fmt.Println(msg, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}

			team, err = measure.EnsureDefaultTeam(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), msrUser)
			if err != nil {
				msg := "failed to lookup user's team"
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

		authSess, err := authsession.NewAuthSession(deps.Config.AccessTokenSecret, deps.Config.RefreshTokenSecret, userId, "google", userMeta)
		if err != nil {
			return
		}

		if err = authSess.Save(ctx, deps.PgPool, nil); err != nil {
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"access_token":  authSess.AccessToken,
			"refresh_token": authSess.RefreshToken,
			"session_id":    authSess.ID,
			"user_id":       userId,
			"own_team_id":   team.ID,
		})

		return
	default:
		fmt.Println(msg)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}
}

// ValidateInvite checks if the invite is valid.
func (h Handlers) ValidateInvite(c *gin.Context) {
	deps := h.Deps
	var payload struct {
		InviteId string `json:"invite_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := "inviteId is required"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	inviteId, err := uuid.Parse(payload.InviteId)
	if err != nil {
		msg := "inviteId is invalid"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	// Query the invite from the database
	stmt := sqlf.PostgreSQL.From("invites").
		Select("created_at").
		Where("id = ?", inviteId)
	defer stmt.Close()

	var createdAt time.Time

	err = deps.PgPool.QueryRow(c.Request.Context(), stmt.String(), stmt.Args()...).
		Scan(&createdAt)

	if err != nil {
		if err == pgx.ErrNoRows {
			msg := "invite not found"
			fmt.Println(msg)
			c.JSON(http.StatusNotFound, gin.H{
				"error": msg,
			})
			return
		}
		msg := "failed to query invite"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	// Check if invite has expired
	expiryTime := createdAt.Add(measure.TeamInviteValidity)
	if time.Now().After(expiryTime) {
		msg := "invite has expired"
		fmt.Println(msg)
		c.JSON(http.StatusGone, gin.H{
			"error": msg,
		})
		return
	}

	// Invite is valid
	c.JSON(http.StatusOK, gin.H{
		"valid": true,
	})
}

// RefreshToken refreshes a previous session from
// its refresh token.
func (h Handlers) RefreshToken(c *gin.Context) {
	deps := h.Deps
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

	oldSession, err := authsession.GetAuthSession(ctx, deps.PgPool, jti)
	if errors.Is(err, pgx.ErrNoRows) {
		msg := "could not verify authenticity of the refresh token"
		fmt.Println(msg, err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": msg,
		})
		return
	}

	msg := `failed to refresh session`

	tx, err := deps.PgPool.Begin(ctx)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	defer tx.Rollback(ctx)

	newSession, err := authsession.NewAuthSession(deps.Config.AccessTokenSecret, deps.Config.RefreshTokenSecret, oldSession.UserID, oldSession.OAuthProvider, oldSession.UserMeta)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err = authsession.RemoveSession(ctx, deps.PgPool, jti, &tx); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err = newSession.Save(ctx, deps.PgPool, &tx); err != nil {
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

// GetSession returns the current session information
func (h Handlers) GetAuthSession(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	sessionId := c.GetString("sessionId")

	ctx := c.Request.Context()

	if userId == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Not authenticated",
		})
		return
	}

	user := &measure.User{
		ID: &userId,
	}

	err := user.GetUserDetails(ctx, deps.PgPool)

	if err != nil {
		msg := "Unable to get user details"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	jti, err := uuid.Parse(sessionId)
	if err != nil {
		msg := "failed to parse session id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	session, err := authsession.GetAuthSession(ctx, deps.PgPool, jti)
	if errors.Is(err, pgx.ErrNoRows) {
		msg := "could not fetch session"
		fmt.Println(msg, err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": msg,
		})
		return
	}

	ownTeam, err := measure.EnsureDefaultTeam(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), user)
	if err != nil {
		msg := "Unable to get user's team"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	// parse avatar url from user meta
	// depending on the oauth provider
	var userMeta map[string]any
	if err := json.Unmarshal(session.UserMeta, &userMeta); err != nil {
		msg := "failed to parse user meta data"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	var avatarUrl string
	if session.OAuthProvider == "github" {
		avatarUrl = userMeta["avatar_url"].(string)
	} else if session.OAuthProvider == "google" {
		avatarUrl = userMeta["picture"].(string)
	} else {
		msg := "invalid oauth provider: " + session.OAuthProvider
		fmt.Println(msg, err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":              userId,
			"own_team_id":     ownTeam.ID,
			"name":            user.Name,
			"email":           user.Email,
			"avatar_url":      avatarUrl,
			"confirmed_at":    user.ConfirmedAt,
			"last_sign_in_at": user.LastSignInAt,
			"created_at":      user.CreatedAt,
			"updated_at":      user.UpdatedAt,
		},
	})
}

// Signout removes the active session associated to
// the refresh token.
func (h Handlers) Signout(c *gin.Context) {
	deps := h.Deps
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

	if err := authsession.RemoveSession(ctx, deps.PgPool, jti, nil); err != nil {
		msg := "failed to signout"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
	})
}
