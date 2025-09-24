package measure

import (
	"backend/api/authsession"
	"backend/api/cipher"
	"backend/api/server"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/leporo/sqlf"
	"google.golang.org/api/idtoken"
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

		accessToken, err := jwt.Parse(token, func(token *jwt.Token) (any, error) {
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
func ValidateRefreshToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractRefreshToken(c)

		refreshToken, err := jwt.Parse(token, func(token *jwt.Token) (any, error) {
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

// addNewUserToInvitedTeams adds a new user to the teams
// they were invited to and removes the invites after the addition.
//
// This is called when a new user is created via OAuth flow.
func addNewUserToInvitedTeams(ctx context.Context, userId string, email string) error {
	invites, err := GetValidInvitesForEmail(ctx, email)
	if err != nil {
		return err
	}

	// Add user to invited teams
	for _, invite := range invites {
		invitedToTeam := &Team{
			ID: &invite.InvitedToTeamId,
		}

		invitee := &Invitee{
			ID:    uuid.MustParse(userId),
			Email: invite.Email,
			Role:  invite.InvitedAsRole,
		}
		invitees := []Invitee{*invitee}
		if err := invitedToTeam.addMembers(ctx, invitees); err != nil {
			return err
		}
		// remove the invite after adding the user
		if err := invitedToTeam.removeInvite(ctx, invite.ID); err != nil {
			return err
		}
	}

	return nil
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

			if err := addNewUserToInvitedTeams(ctx, *msrUser.ID, ghUser.Email); err != nil {
				// If there is an error while adding user to invited team,
				// log and continue. We don't want to fail sign in process
				// because of this.
				fmt.Println(msg, err)
			}
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

		authSess, err := authsession.NewAuthSession(userId, "github", userMeta)
		if err != nil {
			return
		}

		if err = authSess.Save(ctx, nil); err != nil {
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
		ID:      payload.Subject,
		Name:    payload.Claims["name"].(string),
		Email:   payload.Claims["email"].(string),
		Picture: payload.Claims["picture"].(string),
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

		if err := addNewUserToInvitedTeams(ctx, *msrUser.ID, googUser.Email); err != nil {
			// If there is an error while adding user to invited team,
			// log and continue. We don't want to fail sign in process
			// because of this.
			fmt.Println(msg, err)
		}

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

	authSess, err := authsession.NewAuthSession(userId, "google", userMeta)
	if err != nil {
		return
	}

	if err = authSess.Save(ctx, nil); err != nil {
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  authSess.AccessToken,
		"refresh_token": authSess.RefreshToken,
		"session_id":    authSess.ID,
		"user_id":       userId,
		"own_team_id":   team.ID,
	})
}

func ConnectSlackApp(c *gin.Context) {
	ctx := c.Request.Context()

	type slackOAuthRequest struct {
		Code   string `json:"code" binding:"required"`
		UserId string `json:"userId" binding:"required"`
		TeamId string `json:"teamId" binding:"required"`
	}

	var req slackOAuthRequest
	msg := "failed to connect Slack app"

	if err := c.ShouldBindJSON(&req); err != nil {
		fmt.Println(msg, err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": "missing or invalid request body",
		})
		return
	}

	if ok, err := PerformAuthz(req.UserId, req.TeamId, *ScopeTeamAll); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, req.TeamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	if req.Code == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": "missing authorization code",
		})
		return
	}

	// Exchange code with Slack
	client := &http.Client{Timeout: 30 * time.Second}
	data := url.Values{}
	data.Set("client_id", server.Server.Config.SlackClientID)
	data.Set("client_secret", server.Server.Config.SlackClientSecret)
	data.Set("code", req.Code)

	slackReq, err := http.NewRequestWithContext(ctx, "POST", "https://slack.com/api/oauth.v2.access", strings.NewReader(data.Encode()))
	if err != nil {
		fmt.Println(msg, "failed to create request:", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	slackReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.Do(slackReq)
	if err != nil {
		fmt.Println(msg, "failed to exchange code:", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Println(msg, "Slack API returned status:", resp.StatusCode)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// Parse Slack response
	type slackResponse struct {
		OK          bool   `json:"ok"`
		Error       string `json:"error,omitempty"`
		AccessToken string `json:"access_token"`
		Scope       string `json:"scope"`
		BotUserID   string `json:"bot_user_id"`
		AppID       string `json:"app_id"`
		Team        struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"team"`
		Enterprise struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"enterprise,omitempty"`
	}

	var slackResp slackResponse
	if err := json.NewDecoder(resp.Body).Decode(&slackResp); err != nil {
		fmt.Println(msg, "failed to decode Slack response:", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !slackResp.OK {
		errMsg := "Slack OAuth failed"
		if slackResp.Error != "" {
			errMsg = fmt.Sprintf("Slack OAuth failed: %s", slackResp.Error)
		}
		fmt.Println(msg, errMsg)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// Save Slack integration details to the database
	stmt := sqlf.PostgreSQL.
		InsertInto("measure.team_slack").
		Set("team_id", req.TeamId).
		Set("slack_team_id", slackResp.Team.ID).
		Set("slack_team_name", slackResp.Team.Name).
		Set("enterprise_id", slackResp.Enterprise.ID).
		Set("enterprise_name", slackResp.Enterprise.Name).
		Set("bot_token", slackResp.AccessToken).
		Set("bot_user_id", slackResp.BotUserID).
		Set("slack_app_id", slackResp.AppID).
		Set("scopes", slackResp.Scope).
		Set("channel_ids", pgtype.Array[string]{}).
		Set("is_active", true).
		Set("created_at", time.Now()).
		Set("updated_at", time.Now())

	query := stmt.String() + ` ON CONFLICT (team_id) DO UPDATE SET 
		slack_team_id = EXCLUDED.slack_team_id,
		slack_team_name = EXCLUDED.slack_team_name,
		enterprise_id = EXCLUDED.enterprise_id,
		enterprise_name = EXCLUDED.enterprise_name,
		bot_token = EXCLUDED.bot_token,
		bot_user_id = EXCLUDED.bot_user_id,
		slack_app_id = EXCLUDED.slack_app_id,
		scopes = EXCLUDED.scopes,
		channel_ids = EXCLUDED.channel_ids,
		is_active = EXCLUDED.is_active,
		updated_at = NOW()`

	if _, err := server.Server.PgPool.Exec(ctx, query, stmt.Args()...); err != nil {
		fmt.Println(msg, "failed to save Slack integration:", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	response := gin.H{
		"slack_team_name": slackResp.Team.Name,
	}

	c.JSON(http.StatusOK, response)
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

	newSession, err := authsession.NewAuthSession(oldSession.UserID, oldSession.OAuthProvider, oldSession.UserMeta)
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

// GetSession returns the current session information
func GetAuthSession(c *gin.Context) {
	userId := c.GetString("userId")
	sessionId := c.GetString("sessionId")

	ctx := c.Request.Context()

	if userId == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Not authenticated",
		})
		return
	}

	user := &User{
		ID: &userId,
	}

	ownTeam, err := user.getOwnTeam(ctx)
	if err != nil {
		msg := "Unable to get user's team"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	err = user.getUserDetails(ctx)

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

	session, err := authsession.GetAuthSession(ctx, jti)
	if errors.Is(err, pgx.ErrNoRows) {
		msg := "could not fetch session"
		fmt.Println(msg, err)
		c.JSON(http.StatusUnauthorized, gin.H{
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

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
	})
}
