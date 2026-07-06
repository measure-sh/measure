package mcp

import (
	"backend/agent/agent"
	"backend/agent/server"
	"backend/libs/authsession"
	"backend/libs/concur"
	"backend/libs/measure"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/valkey-io/valkey-go"
)

// --------------------------------------------------------------------------
// Constants & Types
// --------------------------------------------------------------------------

const (
	// mcpAuthCodeTTL is the lifetime of an MCP authorization code.
	mcpAuthCodeTTL = 10 * time.Minute
	// mcpTokenExpiry is the lifetime of an MCP access token.
	mcpTokenExpiry = 90 * 24 * time.Hour
	// mcpValkeyStateTTL is the Valkey TTL for OAuth state.
	mcpValkeyStateTTL = 600 * time.Second
	// mcpProviderTokenCheckInterval is how often the middleware re-validates the
	// third-party OAuth provider token bound to an MCP session.
	mcpProviderTokenCheckInterval = 1 * time.Hour
)

// mcpHTTPError is returned by MCP functions to communicate the HTTP status
// code back to the calling Gin handler.
type mcpHTTPError struct {
	Status  int
	Message string
}

func (e *mcpHTTPError) Error() string { return e.Message }

// mcpGoogleUser holds the Google user info decoded from an ID token.
type mcpGoogleUser struct {
	Name  string
	Email string
}

// mcpUserInfo holds minimal Measure user data needed for MCP auth code issuance.
type mcpUserInfo struct {
	ID uuid.UUID
}

// mcpOAuthStatePayload is stored in Valkey under mcp:oauth:state:{state}.
type mcpOAuthStatePayload struct {
	MCPState      string `json:"mcp_state"`
	ClientID      string `json:"client_id"`
	RedirectURI   string `json:"redirect_uri"`
	CodeChallenge string `json:"code_challenge"`
	Provider      string `json:"provider"`
	GAClientID    string `json:"ga_client_id,omitempty"`
	GCLID         string `json:"gclid,omitempty"`
}

// mcpTokenInfo holds the validated token metadata returned by mcpValidateToken.
type mcpTokenInfo struct {
	TokenID                uuid.UUID
	UserID                 uuid.UUID
	Provider               *string
	ProviderToken          *string
	ProviderTokenCheckedAt *time.Time
}

// --------------------------------------------------------------------------
// Injectable vars (for test overrides)
// --------------------------------------------------------------------------

// mcpExchangeGitHubCodeFn exchanges a GitHub code for an access token.
// Override in tests to avoid real GitHub calls.
var mcpExchangeGitHubCodeFn = func(code, redirectURI, clientKey, clientSecret string) (string, error) {
	return authsession.ExchangeGitHubCodeForToken(
		code,
		redirectURI,
		clientKey,
		clientSecret,
	)
}

// mcpGetGitHubUserFn fetches a GitHub user profile. Override in tests.
var mcpGetGitHubUserFn = func(token string) (authsession.GitHubUser, error) {
	return authsession.GetGitHubUser(token)
}

// mcpExchangeGoogleCodeFn exchanges a Google code for a refresh token and ID token.
// Override in tests to avoid real Google calls.
var mcpExchangeGoogleCodeFn = func(code, redirectURI, clientKey, clientSecret string) (string, string, error) {
	return authsession.ExchangeGoogleCode(
		code,
		redirectURI,
		clientKey,
		clientSecret,
	)
}

// mcpGetGoogleUserFromIDTokenFn decodes a Google ID token for user info.
// Override in tests to avoid real decoding.
var mcpGetGoogleUserFromIDTokenFn = func(idToken string) (mcpGoogleUser, error) {
	claims, err := authsession.DecodeGoogleIDToken(idToken)
	if err != nil {
		return mcpGoogleUser{}, err
	}
	return mcpGoogleUser{Name: claims.Name, Email: claims.Email}, nil
}

// mcpValidateProviderTokenFn validates a third-party OAuth provider token.
// Override in tests to avoid real provider API calls.
var mcpValidateProviderTokenFn = func(provider, token, googleKey, googleSecret string) error {
	switch provider {
	case "github":
		_, err := authsession.GetGitHubUser(token)
		return err
	case "google":
		return authsession.ValidateGoogleRefreshToken(token,
			googleKey,
			googleSecret)
	default:
		return fmt.Errorf("unknown provider: %s", provider)
	}
}

// --------------------------------------------------------------------------
// OAuth helpers
// --------------------------------------------------------------------------

// mcpOAuthMetadata returns the RFC 8414 authorization server metadata map.
func mcpOAuthMetadata(apiOrigin string) map[string]any {
	return map[string]any{
		"issuer":                                apiOrigin,
		"authorization_endpoint":                apiOrigin + "/oauth/authorize",
		"token_endpoint":                        apiOrigin + "/oauth/token",
		"registration_endpoint":                 apiOrigin + "/oauth/register",
		"response_types_supported":              []string{"code"},
		"grant_types_supported":                 []string{"authorization_code"},
		"code_challenge_methods_supported":      []string{"S256"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_post", "none"},
	}
}

// mcpRegisterClient dynamically registers an OAuth client.
// Returns (clientID, rawSecret) on success.
func mcpRegisterClient(ctx context.Context, deps *server.Deps, clientName string, redirectURIs []string) (clientID, rawSecret string, err error) {
	pgPool := deps.PgPool

	clientIDBuf := make([]byte, 8)
	if _, randErr := rand.Read(clientIDBuf); randErr != nil {
		return "", "", &mcpHTTPError{http.StatusInternalServerError, "failed to generate client id"}
	}
	clientID = "msr_client_" + hex.EncodeToString(clientIDBuf)

	rawSecretBuf := make([]byte, 32)
	if _, randErr := rand.Read(rawSecretBuf); randErr != nil {
		return "", "", &mcpHTTPError{http.StatusInternalServerError, "failed to generate client secret"}
	}
	rawSecret = hex.EncodeToString(rawSecretBuf)
	secretHash := mcpSHA256Hex(rawSecret)

	_, dbErr := pgPool.Exec(ctx,
		`INSERT INTO measure.mcp_clients (client_id, client_secret, client_name, redirect_uris) VALUES ($1, $2, $3, $4)`,
		clientID, secretHash, clientName, redirectURIs)
	if dbErr != nil {
		return "", "", &mcpHTTPError{http.StatusInternalServerError, "failed to register client"}
	}

	return clientID, rawSecret, nil
}

// mcpAuthorize validates the client, stores OAuth state in Valkey, and returns
// the provider OAuth redirect URL.
func mcpAuthorize(ctx context.Context, deps *server.Deps, provider, clientID, redirectURI, mcpState, codeChallenge, gaClientID, gclid string) (providerURL string, err error) {
	pgPool := deps.PgPool
	vk := deps.VK
	siteOrigin := deps.Config.SiteOrigin

	var registeredURIs []string
	dbErr := pgPool.QueryRow(ctx,
		`SELECT redirect_uris FROM measure.mcp_clients WHERE client_id = $1`, clientID).
		Scan(&registeredURIs)
	if dbErr != nil {
		return "", &mcpHTTPError{http.StatusBadRequest, "unknown client_id"}
	}

	if !slices.Contains(registeredURIs, redirectURI) {
		return "", &mcpHTTPError{http.StatusBadRequest, "redirect_uri not registered for this client"}
	}

	if codeChallenge == "" {
		return "", &mcpHTTPError{http.StatusBadRequest, "code_challenge is required"}
	}

	if provider == "" {
		return "", &mcpHTTPError{http.StatusBadRequest, "provider is required"}
	}

	stateBuf := make([]byte, 16)
	if _, randErr := rand.Read(stateBuf); randErr != nil {
		return "", &mcpHTTPError{http.StatusInternalServerError, "failed to generate state"}
	}
	oauthState := hex.EncodeToString(stateBuf)

	payload := mcpOAuthStatePayload{
		MCPState:      mcpState,
		ClientID:      clientID,
		RedirectURI:   redirectURI,
		CodeChallenge: codeChallenge,
		Provider:      provider,
		GAClientID:    gaClientID,
		GCLID:         gclid,
	}
	if storeErr := mcpStoreMCPStateInValkey(ctx, vk, oauthState, payload); storeErr != nil {
		return "", &mcpHTTPError{http.StatusInternalServerError, "failed to store state"}
	}

	switch provider {
	case "github":
		callbackURL := siteOrigin + "/auth/callback/github"
		ghParams := url.Values{}
		ghParams.Set("client_id", deps.Config.OAuthGitHubKey)
		ghParams.Set("redirect_uri", callbackURL)
		ghParams.Set("state", "mcp_"+oauthState)
		ghParams.Set("scope", "user:email")
		return "https://github.com/login/oauth/authorize?" + ghParams.Encode(), nil

	case "google":
		callbackURL := siteOrigin + "/auth/callback/google"
		gParams := url.Values{}
		gParams.Set("client_id", deps.Config.OAuthGoogleKey)
		gParams.Set("redirect_uri", callbackURL)
		gParams.Set("state", "mcp_"+oauthState)
		gParams.Set("response_type", "code")
		gParams.Set("scope", "openid email profile")
		gParams.Set("access_type", "offline")
		gParams.Set("prompt", "consent")
		return "https://accounts.google.com/o/oauth2/v2/auth?" + gParams.Encode(), nil

	default:
		return "", &mcpHTTPError{http.StatusBadRequest, "unsupported provider"}
	}
}

// mcpCallback exchanges an OAuth code for a token, finds or creates the
// Measure user, inserts an MCP auth code, and returns the redirect URL
// for the MCP client.
func mcpCallback(ctx context.Context, deps *server.Deps, code, state string) (redirectURL string, err error) {
	pgPool := deps.PgPool
	vk := deps.VK
	siteOrigin := deps.Config.SiteOrigin

	key := mcpValkeyStateKey(state)
	val, vkErr := vk.Do(ctx, vk.B().Get().Key(key).Build()).ToString()
	if vkErr != nil {
		return "", &mcpHTTPError{http.StatusBadRequest, "unknown or expired state"}
	}

	var statePayload mcpOAuthStatePayload
	if jsonErr := json.Unmarshal([]byte(val), &statePayload); jsonErr != nil {
		return "", &mcpHTTPError{http.StatusInternalServerError, "failed to decode state"}
	}

	// Delete state from Valkey (one-time use).
	_ = vk.Do(ctx, vk.B().Del().Key(key).Build()).Error()

	if code == "" {
		return "", &mcpHTTPError{http.StatusBadRequest, "missing code"}
	}

	var userName, userEmail string
	var providerName, providerToken string

	callbackURL := siteOrigin + "/auth/callback/" + statePayload.Provider

	switch statePayload.Provider {
	case "github":
		ghToken, exchErr := mcpExchangeGitHubCodeFn(code, callbackURL, deps.Config.OAuthGitHubKey, deps.Config.OAuthGitHubSecret)
		if exchErr != nil {
			return "", &mcpHTTPError{http.StatusBadGateway, "failed to exchange GitHub code"}
		}

		u, userErr := mcpGetGitHubUserFn(ghToken)
		if userErr != nil {
			return "", &mcpHTTPError{http.StatusBadGateway, "failed to get GitHub user"}
		}

		userName = u.Name
		userEmail = u.Email
		providerName = "github"
		providerToken = ghToken

	case "google":
		refreshToken, idToken, exchErr := mcpExchangeGoogleCodeFn(code, callbackURL, deps.Config.OAuthGoogleKey, deps.Config.OAuthGoogleSecret)
		if exchErr != nil {
			return "", &mcpHTTPError{http.StatusBadGateway, "failed to exchange Google code"}
		}

		gUser, userErr := mcpGetGoogleUserFromIDTokenFn(idToken)
		if userErr != nil {
			return "", &mcpHTTPError{http.StatusBadGateway, "failed to get Google user info"}
		}

		userName = gUser.Name
		userEmail = gUser.Email
		providerName = "google"
		providerToken = refreshToken

	default:
		return "", &mcpHTTPError{http.StatusBadRequest, "unsupported provider in state"}
	}

	msrUser, fcErr := mcpFindOrCreateUser(ctx, deps, userName, userEmail, providerName, statePayload.GAClientID, statePayload.GCLID)
	if fcErr != nil {
		return "", &mcpHTTPError{http.StatusInternalServerError, "failed to find or create user"}
	}

	authCodeBuf := make([]byte, 32)
	if _, randErr := rand.Read(authCodeBuf); randErr != nil {
		return "", &mcpHTTPError{http.StatusInternalServerError, "failed to generate auth code"}
	}
	authCode := hex.EncodeToString(authCodeBuf)
	expiresAt := time.Now().Add(mcpAuthCodeTTL)

	_, dbErr := pgPool.Exec(ctx,
		`INSERT INTO measure.mcp_auth_codes (code, user_id, client_id, redirect_uri, code_challenge, provider, provider_token, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		authCode, msrUser.ID, statePayload.ClientID, statePayload.RedirectURI, statePayload.CodeChallenge, providerName, providerToken, expiresAt)
	if dbErr != nil {
		return "", &mcpHTTPError{http.StatusInternalServerError, "failed to create auth code"}
	}

	redirectParams := url.Values{}
	redirectParams.Set("code", authCode)
	if statePayload.MCPState != "" {
		redirectParams.Set("state", statePayload.MCPState)
	}
	return statePayload.RedirectURI + "?" + redirectParams.Encode(), nil
}

// mcpToken exchanges an MCP auth code for a long-lived access token.
// Returns the raw token string on success.
func mcpToken(ctx context.Context, deps *server.Deps, code, redirectURI, clientID, codeVerifier string) (rawToken string, err error) {
	pgPool := deps.PgPool

	var (
		dbUserID        uuid.UUID
		dbClientID      string
		dbRedirectURI   string
		dbCodeChallenge string
		dbProvider      *string
		dbProviderToken *string
		dbExpiresAt     time.Time
		dbUsed          bool
	)

	dbErr := pgPool.QueryRow(ctx,
		`SELECT user_id, client_id, redirect_uri, code_challenge, provider, provider_token, expires_at, used
		 FROM measure.mcp_auth_codes WHERE code = $1`, code).
		Scan(&dbUserID, &dbClientID, &dbRedirectURI, &dbCodeChallenge, &dbProvider, &dbProviderToken, &dbExpiresAt, &dbUsed)
	if dbErr != nil {
		return "", &mcpHTTPError{http.StatusBadRequest, "invalid or unknown code"}
	}

	if dbUsed {
		return "", &mcpHTTPError{http.StatusBadRequest, "code already used"}
	}
	if time.Now().After(dbExpiresAt) {
		return "", &mcpHTTPError{http.StatusBadRequest, "code has expired"}
	}
	if clientID != "" && clientID != dbClientID {
		return "", &mcpHTTPError{http.StatusBadRequest, "client_id mismatch"}
	}
	if redirectURI != "" && redirectURI != dbRedirectURI {
		return "", &mcpHTTPError{http.StatusBadRequest, "redirect_uri mismatch"}
	}
	if dbCodeChallenge != "" {
		if codeVerifier == "" {
			return "", &mcpHTTPError{http.StatusBadRequest, "code_verifier is required"}
		}
		if !mcpVerifyPKCES256(codeVerifier, dbCodeChallenge) {
			return "", &mcpHTTPError{http.StatusBadRequest, "code_verifier does not match code_challenge"}
		}
	}

	_, updErr := pgPool.Exec(ctx,
		`UPDATE measure.mcp_auth_codes SET used = true WHERE code = $1`, code)
	if updErr != nil {
		return "", &mcpHTTPError{http.StatusInternalServerError, "failed to invalidate code"}
	}

	rawTokenBuf := make([]byte, 32)
	if _, randErr := rand.Read(rawTokenBuf); randErr != nil {
		return "", &mcpHTTPError{http.StatusInternalServerError, "failed to generate token"}
	}
	rawToken = "msr_" + base64.RawURLEncoding.EncodeToString(rawTokenBuf)
	tokenHash := mcpSHA256Hex(rawToken)
	expiresAt := time.Now().Add(mcpTokenExpiry)

	_, insErr := pgPool.Exec(ctx,
		`INSERT INTO measure.mcp_access_tokens (token_hash, user_id, client_id, expires_at, provider, provider_token, provider_token_checked_at)
		 VALUES ($1, $2, $3, $4, $5, $6, now())`,
		tokenHash, dbUserID, dbClientID, expiresAt, dbProvider, dbProviderToken)
	if insErr != nil {
		return "", &mcpHTTPError{http.StatusInternalServerError, "failed to create access token"}
	}

	return rawToken, nil
}

// mcpSHA256Hex returns the hex-encoded SHA-256 hash of s.
func mcpSHA256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// mcpVerifyPKCES256 checks that base64url_nopad(sha256(verifier)) == challenge.
func mcpVerifyPKCES256(verifier, challenge string) bool {
	h := sha256.Sum256([]byte(verifier))
	computed := base64.RawURLEncoding.EncodeToString(h[:])
	return computed == challenge
}

// mcpValkeyStateKey returns the Valkey key for an OAuth state.
func mcpValkeyStateKey(state string) string {
	return fmt.Sprintf("mcp:oauth:state:%s", state)
}

// mcpStoreMCPStateInValkey stores an mcpOAuthStatePayload in Valkey under the state key.
func mcpStoreMCPStateInValkey(ctx context.Context, vk valkey.Client, state string, payload mcpOAuthStatePayload) error {
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	key := mcpValkeyStateKey(state)
	return vk.Do(ctx, vk.B().Set().Key(key).Value(string(b)).Ex(mcpValkeyStateTTL).Build()).Error()
}

// mcpFindOrCreateUser finds an existing Measure user by email or creates a new
// one (including a default team) via the same logic used by SigninGitHub.
func mcpFindOrCreateUser(ctx context.Context, deps *server.Deps, name, email, provider, gaClientID, gclid string) (mcpUserInfo, error) {
	msrUser, err := measure.FindUserByEmail(ctx, deps.PgPool, email)
	if err != nil {
		return mcpUserInfo{}, fmt.Errorf("failed to find user: %w", err)
	}

	msg := "failed to create user"
	if msrUser == nil {
		msrUser = measure.NewUser(name, email)
		if err := msrUser.Save(ctx, deps.PgPool, nil); err != nil {
			return mcpUserInfo{}, fmt.Errorf("%s: %w", msg, err)
		}

		if err := measure.SaveUserAttribution(ctx, deps.PgPool, *msrUser.ID, gaClientID, gclid); err != nil {
			fmt.Println("mcp: failed to save user attribution:", err)
		}

		measure.FireSignupEvent(ctx, msrUser, provider, gaClientID)

		if err := measure.CreateNotifPref(deps.PgPool, uuid.MustParse(*msrUser.ID)); err != nil {
			fmt.Println("mcp: failed to create notif prefs:", err)
		}

		userName := msrUser.FirstName()
		teamName := fmt.Sprintf("%s's team", userName)
		team := &measure.Team{Name: &teamName}

		tx, err := deps.PgPool.Begin(ctx)
		if err != nil {
			return mcpUserInfo{}, fmt.Errorf("%s: %w", msg, err)
		}
		defer tx.Rollback(ctx)

		if err := team.Create(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), msrUser, &tx); err != nil {
			return mcpUserInfo{}, fmt.Errorf("%s: %w", msg, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return mcpUserInfo{}, fmt.Errorf("%s: %w", msg, err)
		}

		measure.FireTeamCreatedEvent(ctx, msrUser, team)

		if err := measure.AddNewUserToInvitedTeams(ctx, deps.PgPool, *msrUser.ID, email); err != nil {
			fmt.Println("mcp: failed to add user to invited teams:", err)
		}
	} else {
		if err := msrUser.TouchLastSignInAt(ctx, deps.PgPool); err != nil {
			fmt.Println("mcp: failed to touch last_sign_in_at:", err)
		}
	}

	return mcpUserInfo{ID: uuid.MustParse(*msrUser.ID)}, nil
}

// --------------------------------------------------------------------------
// Token helpers
// --------------------------------------------------------------------------

// mcpValidateToken validates a raw MCP bearer token against the database.
func mcpValidateToken(ctx context.Context, deps *server.Deps, rawToken string) (mcpTokenInfo, error) {
	pgPool := deps.PgPool

	if rawToken == "" {
		return mcpTokenInfo{}, &mcpHTTPError{http.StatusUnauthorized, "empty bearer token"}
	}

	tokenHash := mcpSHA256Hex(rawToken)

	var info mcpTokenInfo
	dbErr := pgPool.QueryRow(ctx,
		`SELECT id, user_id, provider, provider_token, provider_token_checked_at
		 FROM measure.mcp_access_tokens
		 WHERE token_hash = $1 AND NOT revoked AND expires_at > now()`,
		tokenHash).Scan(&info.TokenID, &info.UserID, &info.Provider, &info.ProviderToken, &info.ProviderTokenCheckedAt)
	if dbErr != nil {
		return mcpTokenInfo{}, &mcpHTTPError{http.StatusUnauthorized, "invalid or expired token"}
	}

	return info, nil
}

// mcpRevokeToken marks the given token as revoked.
func mcpRevokeToken(ctx context.Context, deps *server.Deps, tokenID uuid.UUID) error {
	pgPool := deps.PgPool
	_, err := pgPool.Exec(ctx,
		`UPDATE measure.mcp_access_tokens SET revoked = true WHERE id = $1`, tokenID)
	if err != nil {
		return fmt.Errorf("revoke token: %w", err)
	}
	return nil
}

// mcpUpdateProviderTokenCheckedAt updates the provider_token_checked_at timestamp.
func mcpUpdateProviderTokenCheckedAt(ctx context.Context, deps *server.Deps, tokenID uuid.UUID) error {
	pgPool := deps.PgPool
	_, err := pgPool.Exec(ctx,
		`UPDATE measure.mcp_access_tokens SET provider_token_checked_at = now() WHERE id = $1`, tokenID)
	if err != nil {
		return fmt.Errorf("update provider_token_checked_at: %w", err)
	}
	return nil
}

// mcpUpdateLastUsedAt updates the last_used_at timestamp for the given token.
func mcpUpdateLastUsedAt(ctx context.Context, deps *server.Deps, tokenID uuid.UUID) error {
	pgPool := deps.PgPool
	_, err := pgPool.Exec(ctx,
		`UPDATE measure.mcp_access_tokens SET last_used_at = now() WHERE id = $1`, tokenID)
	if err != nil {
		return fmt.Errorf("update last_used_at: %w", err)
	}
	return nil
}

// mcpParseBearerToken extracts the raw token from an "Authorization: Bearer <token>" header.
func mcpParseBearerToken(authHeader string) (string, error) {
	if authHeader == "" {
		return "", &mcpHTTPError{http.StatusUnauthorized, "missing Authorization header"}
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", &mcpHTTPError{http.StatusUnauthorized, "invalid Authorization header format"}
	}
	token := strings.TrimSpace(parts[1])
	if token == "" {
		return "", &mcpHTTPError{http.StatusUnauthorized, "empty bearer token"}
	}
	return token, nil
}

// --------------------------------------------------------------------------
// Gin handlers & middleware
// --------------------------------------------------------------------------

// MCPOAuthMetadata handles GET /.well-known/oauth-authorization-server.
func (h Handlers) MCPOAuthMetadata(c *gin.Context) {
	deps := h.Deps
	c.JSON(http.StatusOK, mcpOAuthMetadata(deps.Config.AgentOrigin))
}

// MCPRegisterClient handles POST /oauth/register.
func (h Handlers) MCPRegisterClient(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()

	var req struct {
		ClientName   string   `json:"client_name"`
		RedirectURIs []string `json:"redirect_uris"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.ClientName == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "client_name is required"})
		return
	}
	if len(req.RedirectURIs) == 0 {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "redirect_uris must not be empty"})
		return
	}

	clientID, rawSecret, err := mcpRegisterClient(ctx, deps, req.ClientName, req.RedirectURIs)
	if err != nil {
		herr := err.(*mcpHTTPError)
		c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
		return
	}

	fmt.Printf("mcp: registered client %q (%s)\n", req.ClientName, clientID)
	c.JSON(http.StatusCreated, gin.H{
		"client_id":                  clientID,
		"client_secret":              rawSecret,
		"client_name":                req.ClientName,
		"redirect_uris":              req.RedirectURIs,
		"token_endpoint_auth_method": "client_secret_post",
	})
}

// MCPAuthorize handles GET /oauth/authorize.
// When no provider query param is set, it redirects to the dashboard login page.
// Otherwise it redirects to the chosen provider's OAuth flow.
func (h Handlers) MCPAuthorize(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()

	responseType := c.Query("response_type")
	clientID := c.Query("client_id")
	redirectURI := c.Query("redirect_uri")
	mcpState := c.Query("state")
	codeChallenge := c.Query("code_challenge")
	provider := c.Query("provider")
	gaClientID := c.Query("ga_client_id")
	gclid := c.Query("gclid")

	if responseType != "code" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "unsupported response_type"})
		return
	}
	if clientID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "client_id is required"})
		return
	}
	if redirectURI == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "redirect_uri is required"})
		return
	}

	// No provider selected — redirect to the dashboard login page.
	if provider == "" {
		params := c.Request.URL.Query()
		params.Set("mcp", "1")
		loginURL := deps.Config.SiteOrigin + "/auth/login?" + params.Encode()
		c.Redirect(http.StatusFound, loginURL)
		return
	}

	providerURL, err := mcpAuthorize(ctx, deps, provider, clientID, redirectURI, mcpState, codeChallenge, gaClientID, gclid)
	if err != nil {
		herr := err.(*mcpHTTPError)
		c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
		return
	}

	fmt.Printf("mcp: authorize redirect issued (client=%s provider=%s)\n", clientID, provider)
	c.Redirect(http.StatusFound, providerURL)
}

// MCPCallbackExchange handles POST /mcp/auth/callback.
// The frontend detects "mcp_" prefix on the OAuth state, strips it, and
// POSTs {code, state} here. This handler exchanges the code, creates an
// MCP auth code, and returns the redirect URL for the MCP client.
func (h Handlers) MCPCallbackExchange(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()

	var req struct {
		Code  string `json:"code"`
		State string `json:"state"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.State == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing state"})
		return
	}

	redirectURL, err := mcpCallback(ctx, deps, req.Code, req.State)
	if err != nil {
		herr := err.(*mcpHTTPError)
		c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
		return
	}

	fmt.Println("mcp: oauth callback exchanged for auth code")
	c.JSON(http.StatusOK, gin.H{"redirect_url": redirectURL})
}

// MCPToken handles POST /oauth/token.
func (h Handlers) MCPToken(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()

	grantType := c.PostForm("grant_type")
	code := c.PostForm("code")
	redirectURI := c.PostForm("redirect_uri")
	clientID := c.PostForm("client_id")
	codeVerifier := c.PostForm("code_verifier")

	// Also support JSON body.
	if grantType == "" {
		var body struct {
			GrantType    string `json:"grant_type"`
			Code         string `json:"code"`
			RedirectURI  string `json:"redirect_uri"`
			ClientID     string `json:"client_id"`
			CodeVerifier string `json:"code_verifier"`
		}
		if err := c.ShouldBindJSON(&body); err == nil {
			grantType = body.GrantType
			code = body.Code
			redirectURI = body.RedirectURI
			clientID = body.ClientID
			codeVerifier = body.CodeVerifier
		}
	}

	if grantType != "authorization_code" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "unsupported grant_type"})
		return
	}
	if code == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "code is required"})
		return
	}

	rawToken, err := mcpToken(ctx, deps, code, redirectURI, clientID, codeVerifier)
	if err != nil {
		herr := err.(*mcpHTTPError)
		c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
		return
	}

	fmt.Printf("mcp: access token issued (client=%s)\n", clientID)
	c.JSON(http.StatusOK, gin.H{
		"access_token": rawToken,
		"token_type":   "Bearer",
		"expires_in":   int(mcpTokenExpiry.Seconds()),
	})
}

// ValidateMCPToken validates an MCP bearer token from the Authorization header.
// On success it sets "userId" in the Gin context and injects it into the request
// context so that mcp-go tool handlers can read it.
func (h Handlers) ValidateMCPToken() gin.HandlerFunc {
	deps := h.Deps
	return func(c *gin.Context) {
		rawToken, err := mcpParseBearerToken(c.GetHeader("Authorization"))
		if err != nil {
			herr := err.(*mcpHTTPError)
			c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
			return
		}

		ctx := c.Request.Context()
		info, err := mcpValidateToken(ctx, deps, rawToken)
		if err != nil {
			herr := err.(*mcpHTTPError)
			c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
			return
		}

		// Update last_used_at asynchronously.
		concur.GlobalWg.Go(func() {
			if updateErr := mcpUpdateLastUsedAt(context.Background(), deps, info.TokenID); updateErr != nil {
				fmt.Println("mcp: failed to update last_used_at:", updateErr)
			}
		})

		// Session binding: periodically validate the third-party provider token.
		if info.ProviderToken != nil && *info.ProviderToken != "" {
			needsCheck := info.ProviderTokenCheckedAt == nil ||
				time.Since(*info.ProviderTokenCheckedAt) > mcpProviderTokenCheckInterval
			if needsCheck {
				provider := ""
				if info.Provider != nil {
					provider = *info.Provider
				}
				providerToken := *info.ProviderToken
				tokenID := info.TokenID
				concur.GlobalWg.Go(func() {
					if valErr := mcpValidateProviderTokenFn(provider, providerToken, deps.Config.OAuthGoogleKey, deps.Config.OAuthGoogleSecret); valErr != nil {
						fmt.Printf("mcp: revoking token %s, provider token check failed: %v\n", tokenID, valErr)
						if revokeErr := mcpRevokeToken(context.Background(), deps, tokenID); revokeErr != nil {
							fmt.Println("mcp: failed to revoke token:", revokeErr)
						}
					} else {
						if updErr := mcpUpdateProviderTokenCheckedAt(context.Background(), deps, tokenID); updErr != nil {
							fmt.Println("mcp: failed to update provider_token_checked_at:", updErr)
						}
					}
				})
			}
		}

		userIDStr := info.UserID.String()
		c.Set("userId", userIDStr)

		// Inject user ID into the request context for the tool handlers.
		newCtx := agent.WithUserID(ctx, userIDStr)
		c.Request = c.Request.WithContext(newCtx)

		c.Next()
	}
}
