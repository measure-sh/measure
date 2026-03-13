package measure

import (
	"backend/api/authsession"
	"backend/api/filter"
	"backend/api/group"
	"backend/api/network"
	"backend/api/server"
	"backend/libs/ambient"
	"backend/libs/concur"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/jsonschema-go/jsonschema"
	"github.com/google/uuid"
	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
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

// mcpGitHubUser holds the GitHub user info returned after OAuth.
type mcpGitHubUser struct {
	Name  string
	Email string
}

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
}

// mcpTokenInfo holds the validated token metadata returned by mcpValidateToken.
type mcpTokenInfo struct {
	TokenID                uuid.UUID
	UserID                 uuid.UUID
	Provider               *string
	ProviderToken          *string
	ProviderTokenCheckedAt *time.Time
}

// mcpUserIDKey is the context key used to propagate the authenticated user ID
// from the Gin middleware into mcp-go tool handlers.
type mcpUserIDKey struct{}

// --------------------------------------------------------------------------
// Injectable vars (for test overrides)
// --------------------------------------------------------------------------

// mcpExchangeGitHubCodeFn exchanges a GitHub code for an access token.
// Override in tests to avoid real GitHub calls.
var mcpExchangeGitHubCodeFn = func(code, redirectURI string) (string, error) {
	return authsession.ExchangeGitHubCodeForToken(
		code,
		redirectURI,
		server.Server.Config.OAuthGitHubKey,
		server.Server.Config.OAuthGitHubSecret,
	)
}

// mcpGetGitHubUserFn fetches a GitHub user profile. Override in tests.
var mcpGetGitHubUserFn = func(token string) (authsession.GitHubUser, error) {
	return authsession.GetGitHubUser(token)
}

// mcpExchangeGoogleCodeFn exchanges a Google code for a refresh token and ID token.
// Override in tests to avoid real Google calls.
var mcpExchangeGoogleCodeFn = func(code, redirectURI string) (string, string, error) {
	return authsession.ExchangeGoogleCode(
		code,
		redirectURI,
		server.Server.Config.OAuthGoogleKey,
		server.Server.Config.OAuthGoogleSecret,
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
var mcpValidateProviderTokenFn = func(provider, token string) error {
	switch provider {
	case "github":
		_, err := authsession.GetGitHubUser(token)
		return err
	case "google":
		return authsession.ValidateGoogleRefreshToken(token,
			server.Server.Config.OAuthGoogleKey,
			server.Server.Config.OAuthGoogleSecret)
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
func mcpRegisterClient(ctx context.Context, clientName string, redirectURIs []string) (clientID, rawSecret string, err error) {
	pgPool := server.Server.PgPool

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
func mcpAuthorize(ctx context.Context, provider, clientID, redirectURI, mcpState, codeChallenge string) (providerURL string, err error) {
	pgPool := server.Server.PgPool
	vk := server.Server.VK
	siteOrigin := server.Server.Config.SiteOrigin

	var registeredURIs []string
	dbErr := pgPool.QueryRow(ctx,
		`SELECT redirect_uris FROM measure.mcp_clients WHERE client_id = $1`, clientID).
		Scan(&registeredURIs)
	if dbErr != nil {
		return "", &mcpHTTPError{http.StatusBadRequest, "unknown client_id"}
	}

	if !mcpStringSliceContains(registeredURIs, redirectURI) {
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
	}
	if storeErr := mcpStoreMCPStateInValkey(ctx, vk, oauthState, payload); storeErr != nil {
		return "", &mcpHTTPError{http.StatusInternalServerError, "failed to store state"}
	}

	switch provider {
	case "github":
		callbackURL := siteOrigin + "/auth/callback/github"
		ghParams := url.Values{}
		ghParams.Set("client_id", server.Server.Config.OAuthGitHubKey)
		ghParams.Set("redirect_uri", callbackURL)
		ghParams.Set("state", "mcp_"+oauthState)
		ghParams.Set("scope", "user:email")
		return "https://github.com/login/oauth/authorize?" + ghParams.Encode(), nil

	case "google":
		callbackURL := siteOrigin + "/auth/callback/google"
		gParams := url.Values{}
		gParams.Set("client_id", server.Server.Config.OAuthGoogleKey)
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
func mcpCallback(ctx context.Context, code, state string) (redirectURL string, err error) {
	pgPool := server.Server.PgPool
	vk := server.Server.VK
	siteOrigin := server.Server.Config.SiteOrigin

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
		ghToken, exchErr := mcpExchangeGitHubCodeFn(code, callbackURL)
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
		refreshToken, idToken, exchErr := mcpExchangeGoogleCodeFn(code, callbackURL)
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

	msrUser, fcErr := mcpFindOrCreateUser(ctx, userName, userEmail)
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
func mcpToken(ctx context.Context, code, redirectURI, clientID, codeVerifier string) (rawToken string, err error) {
	pgPool := server.Server.PgPool

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

// mcpStringSliceContains reports whether s is in slice.
func mcpStringSliceContains(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
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
func mcpFindOrCreateUser(ctx context.Context, name, email string) (mcpUserInfo, error) {
	msrUser, err := FindUserByEmail(ctx, email)
	if err != nil {
		return mcpUserInfo{}, fmt.Errorf("failed to find user: %w", err)
	}

	msg := "failed to create user"
	if msrUser == nil {
		msrUser = NewUser(name, email)
		if err := msrUser.save(ctx, nil); err != nil {
			return mcpUserInfo{}, fmt.Errorf("%s: %w", msg, err)
		}

		userName := msrUser.firstName()
		teamName := fmt.Sprintf("%s's team", userName)
		team := &Team{Name: &teamName}

		tx, err := server.Server.PgPool.Begin(ctx)
		if err != nil {
			return mcpUserInfo{}, fmt.Errorf("%s: %w", msg, err)
		}
		defer tx.Rollback(ctx)

		if err := team.create(ctx, msrUser, &tx); err != nil {
			return mcpUserInfo{}, fmt.Errorf("%s: %w", msg, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return mcpUserInfo{}, fmt.Errorf("%s: %w", msg, err)
		}

		if err := addNewUserToInvitedTeams(ctx, *msrUser.ID, email); err != nil {
			fmt.Println("mcp: failed to add user to invited teams:", err)
		}
	} else {
		if err := msrUser.touchLastSignInAt(ctx); err != nil {
			fmt.Println("mcp: failed to touch last_sign_in_at:", err)
		}
	}

	return mcpUserInfo{ID: uuid.MustParse(*msrUser.ID)}, nil
}

// --------------------------------------------------------------------------
// Token helpers
// --------------------------------------------------------------------------

// mcpValidateToken validates a raw MCP bearer token against the database.
func mcpValidateToken(ctx context.Context, rawToken string) (mcpTokenInfo, error) {
	pgPool := server.Server.PgPool

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
func mcpRevokeToken(ctx context.Context, tokenID uuid.UUID) error {
	pgPool := server.Server.PgPool
	_, err := pgPool.Exec(ctx,
		`UPDATE measure.mcp_access_tokens SET revoked = true WHERE id = $1`, tokenID)
	if err != nil {
		return fmt.Errorf("revoke token: %w", err)
	}
	return nil
}

// mcpUpdateProviderTokenCheckedAt updates the provider_token_checked_at timestamp.
func mcpUpdateProviderTokenCheckedAt(ctx context.Context, tokenID uuid.UUID) error {
	pgPool := server.Server.PgPool
	_, err := pgPool.Exec(ctx,
		`UPDATE measure.mcp_access_tokens SET provider_token_checked_at = now() WHERE id = $1`, tokenID)
	if err != nil {
		return fmt.Errorf("update provider_token_checked_at: %w", err)
	}
	return nil
}

// mcpUpdateLastUsedAt updates the last_used_at timestamp for the given token.
func mcpUpdateLastUsedAt(ctx context.Context, tokenID uuid.UUID) error {
	pgPool := server.Server.PgPool
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

// mcpWithUserID injects a user ID string into the context.
func mcpWithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, mcpUserIDKey{}, userID)
}

// mcpUserIDFromContext extracts the user ID string set by mcpWithUserID.
func mcpUserIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(mcpUserIDKey{}).(string)
	return v, ok && v != ""
}

// --------------------------------------------------------------------------
// Gin handlers & middleware
// --------------------------------------------------------------------------

// MCPOAuthMetadata handles GET /.well-known/oauth-authorization-server.
func MCPOAuthMetadata(c *gin.Context) {
	c.JSON(http.StatusOK, mcpOAuthMetadata(server.Server.Config.APIOrigin))
}

// MCPRegisterClient handles POST /oauth/register.
func MCPRegisterClient(c *gin.Context) {
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

	clientID, rawSecret, err := mcpRegisterClient(ctx, req.ClientName, req.RedirectURIs)
	if err != nil {
		herr := err.(*mcpHTTPError)
		c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
		return
	}

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
func MCPAuthorize(c *gin.Context) {
	ctx := c.Request.Context()

	responseType := c.Query("response_type")
	clientID := c.Query("client_id")
	redirectURI := c.Query("redirect_uri")
	mcpState := c.Query("state")
	codeChallenge := c.Query("code_challenge")
	provider := c.Query("provider")

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
		loginURL := server.Server.Config.SiteOrigin + "/auth/login?" + params.Encode()
		c.Redirect(http.StatusFound, loginURL)
		return
	}

	providerURL, err := mcpAuthorize(ctx, provider, clientID, redirectURI, mcpState, codeChallenge)
	if err != nil {
		herr := err.(*mcpHTTPError)
		c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
		return
	}

	c.Redirect(http.StatusFound, providerURL)
}

// MCPCallbackExchange handles POST /mcp/auth/callback.
// The frontend detects "mcp_" prefix on the OAuth state, strips it, and
// POSTs {code, state} here. This handler exchanges the code, creates an
// MCP auth code, and returns the redirect URL for the MCP client.
func MCPCallbackExchange(c *gin.Context) {
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

	redirectURL, err := mcpCallback(ctx, req.Code, req.State)
	if err != nil {
		herr := err.(*mcpHTTPError)
		c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
		return
	}

	c.JSON(http.StatusOK, gin.H{"redirect_url": redirectURL})
}

// MCPToken handles POST /oauth/token.
func MCPToken(c *gin.Context) {
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

	rawToken, err := mcpToken(ctx, code, redirectURI, clientID, codeVerifier)
	if err != nil {
		herr := err.(*mcpHTTPError)
		c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": rawToken,
		"token_type":   "Bearer",
		"expires_in":   int(mcpTokenExpiry.Seconds()),
	})
}

// ValidateMCPToken validates an MCP bearer token from the Authorization header.
// On success it sets "userId" in the Gin context and injects it into the request
// context so that mcp-go tool handlers can read it.
func ValidateMCPToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		rawToken, err := mcpParseBearerToken(c.GetHeader("Authorization"))
		if err != nil {
			herr := err.(*mcpHTTPError)
			c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
			return
		}

		ctx := c.Request.Context()
		info, err := mcpValidateToken(ctx, rawToken)
		if err != nil {
			herr := err.(*mcpHTTPError)
			c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
			return
		}

		// Update last_used_at asynchronously.
		concur.GlobalWg.Go(func() {
			if updateErr := mcpUpdateLastUsedAt(context.Background(), info.TokenID); updateErr != nil {
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
				concur.GlobalWg.Add(1)
				go func() {
					defer concur.GlobalWg.Done()
					if valErr := mcpValidateProviderTokenFn(provider, providerToken); valErr != nil {
						if revokeErr := mcpRevokeToken(context.Background(), tokenID); revokeErr != nil {
							fmt.Println("mcp: failed to revoke token:", revokeErr)
						}
					} else {
						if updErr := mcpUpdateProviderTokenCheckedAt(context.Background(), tokenID); updErr != nil {
							fmt.Println("mcp: failed to update provider_token_checked_at:", updErr)
						}
					}
				}()
			}
		}

		userIDStr := info.UserID.String()
		c.Set("userId", userIDStr)

		// Inject user ID into request context for mcp-go tool handlers.
		newCtx := mcpWithUserID(ctx, userIDStr)
		c.Request = c.Request.WithContext(newCtx)

		c.Next()
	}
}

// NewMCPHandler creates a configured MCP server with all tools registered
// and returns an http.Handler using the Streamable HTTP transport.
func NewMCPHandler() http.Handler {
	return newMCPServer()
}

// --------------------------------------------------------------------------
// MCP server setup
// --------------------------------------------------------------------------

// newMCPServer creates an MCP server with all tools registered and returns an
// http.Handler using the Streamable HTTP transport.
func newMCPServer() http.Handler {
	s := mcpsdk.NewServer(
		&mcpsdk.Implementation{Name: "Measure", Version: "1.0.0"},
		nil,
	)

	// list_apps
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "list_apps",
		Description: "List all apps the authenticated user has access to",
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpListAppsInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpListApps(ctx, in)
	})

	// get_filters
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_filters",
		Description: "Get available filter options (versions, OS, countries, devices, etc.) for an app",
		InputSchema: mcpMustInferSchema[mcpGetFiltersInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFiltersInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetFilters(ctx, in)
	})

	// get_metrics
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_metrics",
		Description: "Get app metrics including adoption, crash-free/ANR-free sessions, and launch performance (cold/warm/hot p95). Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferSchema[mcpGetMetricsInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetMetricsInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetMetrics(ctx, in)
	})

	// get_errors
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_errors",
		Description: "Get crash or ANR error groups for an app. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferErrorToolSchema[mcpGetErrorsInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorsInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetErrors(ctx, in)
	})

	// get_error
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_error",
		Description: "Get individual crash or ANR events for a specific error group. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferErrorToolSchema[mcpGetErrorInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetError(ctx, in)
	})

	// get_errors_over_time
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_errors_over_time",
		Description: "Get time-series of crash or ANR occurrences across all error groups. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferErrorToolSchema[mcpGetErrorsOverTimeInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetErrorsOverTime(ctx, in)
	})

	// get_error_over_time
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_error_over_time",
		Description: "Get time-series of occurrences for a specific error group. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferErrorToolSchema[mcpGetErrorOverTimeInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetErrorOverTime(ctx, in)
	})

	// get_error_distribution
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_error_distribution",
		Description: "Get attribute distribution (OS, device, version, country) for a specific error group. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferErrorToolSchema[mcpGetErrorDistributionInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorDistributionInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetErrorDistribution(ctx, in)
	})

	// get_sessions
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_sessions",
		Description: "Get sessions for an app, ordered by most recent first. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferSchema[mcpGetSessionsInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSessionsInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetSessions(ctx, in)
	})

	// get_sessions_over_time
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_sessions_over_time",
		Description: "Get time-series of session counts. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferSchema[mcpGetSessionsOverTimeInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSessionsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetSessionsOverTime(ctx, in)
	})

	// get_session
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_session",
		Description: "Get full session with all events",
		InputSchema: mcpMustInferSchema[mcpGetSessionInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSessionInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetSession(ctx, in)
	})

	// get_bug_reports
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_bug_reports",
		Description: "Get bug reports for an app, ordered by most recent first. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferSchema[mcpGetBugReportsInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetBugReportsInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetBugReports(ctx, in)
	})

	// get_bug_reports_over_time
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_bug_reports_over_time",
		Description: "Get time-series of bug report counts. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferSchema[mcpGetBugReportsOverTimeInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetBugReportsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetBugReportsOverTime(ctx, in)
	})

	// get_bug_report
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_bug_report",
		Description: "Get a single bug report with full details",
		InputSchema: mcpMustInferSchema[mcpGetBugReportInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetBugReportInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetBugReport(ctx, in)
	})

	// update_bug_report_status
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "update_bug_report_status",
		Description: "Update the status of a bug report (open or closed)",
		InputSchema: mcpMustInferSchema[mcpUpdateBugReportStatusInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpUpdateBugReportStatusInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpUpdateBugReportStatus(ctx, in)
	})

	// get_root_span_names
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_root_span_names",
		Description: "Get all root span names for an app",
		InputSchema: mcpMustInferSchema[mcpGetRootSpanNamesInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetRootSpanNamesInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetRootSpanNames(ctx, in)
	})

	// get_span_instances
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_span_instances",
		Description: "Get span instances for a root span name. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferSchema[mcpGetSpanInstancesInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSpanInstancesInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetSpanInstances(ctx, in)
	})

	// get_span_metrics_over_time
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_span_metrics_over_time",
		Description: "Get p50/p90/p95/p99 duration metrics over time for a span name. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferSchema[mcpGetSpanMetricsOverTimeInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSpanMetricsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetSpanMetricsOverTime(ctx, in)
	})

	// get_trace
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_trace",
		Description: "Get full trace with all child spans",
		InputSchema: mcpMustInferSchema[mcpGetTraceInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetTraceInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetTrace(ctx, in)
	})

	// get_alerts
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_alerts",
		Description: "Get alerts for an app, ordered by most recent first",
		InputSchema: mcpMustInferSchema[mcpGetAlertsInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetAlertsInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetAlerts(ctx, in)
	})

	// get_journey
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_journey",
		Description: "Get user navigation journey graph with session counts between screens. Defaults to the latest app version if versions/version_codes are not specified. Use get_filters to see all available versions.",
		InputSchema: mcpMustInferSchema[mcpGetJourneyInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetJourneyInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetJourney(ctx, in)
	})

	// get_error_common_path
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_error_common_path",
		Description: "Get the most common user navigation path leading to a specific crash or ANR",
		InputSchema: mcpMustInferErrorToolSchema[mcpGetErrorCommonPathInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorCommonPathInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetErrorCommonPath(ctx, in)
	})

	// get_network_unique_domains
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_network_unique_domains",
		Description: "Get all unique domains observed in HTTP requests for an app",
		InputSchema: mcpMustInferSchema[mcpGetUniqueDomainsInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetUniqueDomainsInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetUniqueDomains(ctx, in)
	})

	// get_network_paths_for_domain
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_network_paths_for_domain",
		Description: "Get all unique URL paths for a domain from HTTP requests, with optional search query",
		InputSchema: mcpMustInferSchema[mcpGetPathsForDomainInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetPathsForDomainInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetPathsForDomain(ctx, in)
	})

	// get_network_metrics_trends
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_network_metrics_trends",
		Description: "Get top network endpoints by latency, error rate, and frequency for domain and path pattern",
		InputSchema: mcpMustInferSchema[mcpGetNetworkTrendsInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetNetworkTrendsInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetNetworkTrends(ctx, in)
	})

	// get_network_status_codes_over_time
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_network_status_codes_over_time",
		Description: "Get HTTP status code distribution over time across all network requests",
		InputSchema: mcpMustInferSchema[mcpGetAppHttpStatusCodesOverTimeInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetAppHttpStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetAppStatusCodesOverTime(ctx, in)
	})

	// get_network_endpoint_latency_over_time
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_network_endpoint_latency_over_time",
		Description: "Get latency percentiles (p50/p90/p95/p99) over time for a specific endpoint",
		InputSchema: mcpMustInferSchema[mcpGetHttpEndpointLatencyOverTimeInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetHttpEndpointLatencyOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetHttpEndpointLatencyOverTime(ctx, in)
	})

	// get_network_endpoint_status_codes_over_time
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_network_endpoint_status_codes_over_time",
		Description: "Get HTTP status code distribution over time for a specific endpoint ",
		InputSchema: mcpMustInferSchema[mcpGetHttpEndpointStatusCodesOverTimeInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetHttpEndpointStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetHttpEndpointStatusCodesOverTime(ctx, in)
	})

	// get_network_requests_timeline
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_network_requests_timeline",
		Description: "Get HTTP requests timeline showing when top endpoints are typically called during a session",
		InputSchema: mcpMustInferSchema[mcpGetNetworkTimelineInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetNetworkTimelineInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetNetworkTimeline(ctx, in)
	})

	// get_network_endpoint_timeline
	mcpsdk.AddTool(s, &mcpsdk.Tool{
		Name:        "get_network_endpoint_timeline",
		Description: "Get HTTP requests timeline for a specific endpoint showing when it is typically called during a session. Only works for known path patterns.",
		InputSchema: mcpMustInferSchema[mcpGetNetworkEndpointTimelineInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetNetworkEndpointTimelineInput) (*mcpsdk.CallToolResult, any, error) {
		return mcpGetNetworkEndpointTimeline(ctx, in)
	})

	return mcpsdk.NewStreamableHTTPHandler(
		func(r *http.Request) *mcpsdk.Server { return s },
		&mcpsdk.StreamableHTTPOptions{Stateless: true},
	)
}

// mcpMustInferSchema infers a JSON schema from a Go type.
func mcpMustInferSchema[T any]() json.RawMessage {
	schema, err := jsonschema.For[T](nil)
	if err != nil {
		panic("mcp: failed to infer schema: " + err.Error())
	}
	data, err := schema.MarshalJSON()
	if err != nil {
		panic("mcp: failed to marshal schema: " + err.Error())
	}
	return json.RawMessage(data)
}

// mcpMustInferErrorToolSchema infers a JSON schema from a Go type and adds an
// enum constraint to the "type" property (crash | anr).
func mcpMustInferErrorToolSchema[T any]() json.RawMessage {
	schema, err := jsonschema.For[T](nil)
	if err != nil {
		panic("mcp: failed to infer schema: " + err.Error())
	}
	if typeSchema, ok := schema.Properties["type"]; ok {
		typeSchema.Enum = []any{"crash", "anr"}
	}
	data, err := schema.MarshalJSON()
	if err != nil {
		panic("mcp: failed to marshal schema: " + err.Error())
	}
	return json.RawMessage(data)
}

// --------------------------------------------------------------------------
// Tool input structs
// --------------------------------------------------------------------------

// mcpCommonFilters contains filter fields shared across most tools.
type mcpCommonFilters struct {
	AppID               string   `json:"app_id" jsonschema:"UUID of the app to query"`
	From                string   `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To                  string   `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	Versions            []string `json:"versions,omitempty" jsonschema:"Filter by app version strings"`
	VersionCodes        []string `json:"version_codes,omitempty" jsonschema:"Filter by app version codes"`
	OsNames             []string `json:"os_names,omitempty" jsonschema:"Filter by OS names (e.g. android, ios)"`
	OsVersions          []string `json:"os_versions,omitempty" jsonschema:"Filter by OS versions"`
	Countries           []string `json:"countries,omitempty" jsonschema:"Filter by country codes (e.g. US, IN)"`
	NetworkProviders    []string `json:"network_providers,omitempty" jsonschema:"Filter by network providers"`
	NetworkTypes        []string `json:"network_types,omitempty" jsonschema:"Filter by network types (e.g. wifi, cellular)"`
	NetworkGenerations  []string `json:"network_generations,omitempty" jsonschema:"Filter by network generations (e.g. 4g, 5g)"`
	Locales             []string `json:"locales,omitempty" jsonschema:"Filter by device locales (e.g. en_US)"`
	DeviceManufacturers []string `json:"device_manufacturers,omitempty" jsonschema:"Filter by device manufacturers"`
	DeviceNames         []string `json:"device_names,omitempty" jsonschema:"Filter by device names"`
}

type mcpListAppsInput struct{}
type mcpGetFiltersInput struct {
	AppID string `json:"app_id" jsonschema:"UUID of the app to query"`
	Type  string `json:"type,omitempty" jsonschema:"Filter type: crash, anr, span, or all (default: all)"`
}
type mcpGetMetricsInput struct {
	mcpCommonFilters
	Limit  int `json:"limit,omitempty" jsonschema:"Maximum number of items to return (default: 10)"`
	Offset int `json:"offset,omitempty" jsonschema:"Number of items to skip for pagination (default: 0)"`
}
type mcpGetErrorsInput struct {
	mcpCommonFilters
	Type   string `json:"type" jsonschema:"Error type: crash or anr"`
	Limit  int    `json:"limit,omitempty" jsonschema:"Maximum number of groups to return (default: 25, max: 100)"`
	Offset int    `json:"offset,omitempty" jsonschema:"Number of groups to skip for pagination (default: 0)"`
}
type mcpGetErrorInput struct {
	mcpCommonFilters
	Type         string `json:"type" jsonschema:"Error type: crash or anr"`
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
	Limit        int    `json:"limit,omitempty" jsonschema:"Maximum number of events to return (default: 1)"`
	Offset       int    `json:"offset,omitempty" jsonschema:"Number of events to skip for pagination (default: 0)"`
}
type mcpGetErrorsOverTimeInput struct {
	mcpCommonFilters
	Type     string `json:"type" jsonschema:"Error type: crash or anr"`
	Timezone string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetErrorOverTimeInput struct {
	mcpCommonFilters
	Type         string `json:"type" jsonschema:"Error type: crash or anr"`
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
	Timezone     string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetErrorDistributionInput struct {
	mcpCommonFilters
	Type         string `json:"type" jsonschema:"Error type: crash or anr"`
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
}
type mcpGetSessionsInput struct {
	mcpCommonFilters
	SessionType     string `json:"session_type,omitempty" jsonschema:"Filter by session type: crash, anr, issues, or all"`
	FreeText        string `json:"free_text,omitempty" jsonschema:"Free text search filter"`
	Foreground      *bool  `json:"foreground,omitempty" jsonschema:"Filter for foreground sessions"`
	Background      *bool  `json:"background,omitempty" jsonschema:"Filter for background sessions"`
	UserInteraction *bool  `json:"user_interaction,omitempty" jsonschema:"Filter for sessions with user interaction"`
	Limit           int    `json:"limit,omitempty" jsonschema:"Maximum number of sessions to return (default: 10)"`
	Offset          int    `json:"offset,omitempty" jsonschema:"Number of sessions to skip for pagination (default: 0)"`
}
type mcpGetSessionsOverTimeInput struct {
	mcpCommonFilters
	SessionType     string `json:"session_type,omitempty" jsonschema:"Filter by session type: crash, anr, issues, or all"`
	FreeText        string `json:"free_text,omitempty" jsonschema:"Free text search filter"`
	Foreground      *bool  `json:"foreground,omitempty" jsonschema:"Filter for foreground sessions"`
	Background      *bool  `json:"background,omitempty" jsonschema:"Filter for background sessions"`
	UserInteraction *bool  `json:"user_interaction,omitempty" jsonschema:"Filter for sessions with user interaction"`
	Timezone        string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetSessionInput struct {
	AppID     string `json:"app_id" jsonschema:"UUID of the app"`
	SessionID string `json:"session_id" jsonschema:"UUID of the session"`
}
type mcpGetBugReportsInput struct {
	mcpCommonFilters
	BugReportStatuses []int  `json:"bug_report_statuses,omitempty" jsonschema:"Filter by status: 0=OPEN, 1=CLOSED"`
	FreeText          string `json:"free_text,omitempty" jsonschema:"Free text search filter"`
	Limit             int    `json:"limit,omitempty" jsonschema:"Maximum number of bug reports to return (default: 10)"`
	Offset            int    `json:"offset,omitempty" jsonschema:"Number of bug reports to skip for pagination (default: 0)"`
}
type mcpGetBugReportsOverTimeInput struct {
	mcpCommonFilters
	BugReportStatuses []int  `json:"bug_report_statuses,omitempty" jsonschema:"Filter by status: 0=OPEN, 1=CLOSED"`
	Timezone          string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetBugReportInput struct {
	AppID       string `json:"app_id" jsonschema:"UUID of the app"`
	BugReportID string `json:"bug_report_id" jsonschema:"ID of the bug report"`
}
type mcpGetRootSpanNamesInput struct {
	AppID string `json:"app_id" jsonschema:"UUID of the app"`
}
type mcpGetSpanInstancesInput struct {
	mcpCommonFilters
	RootSpanName string `json:"root_span_name" jsonschema:"Name of the root span to query"`
	SpanStatuses []int  `json:"span_statuses,omitempty" jsonschema:"Filter by span status: 0=Unset, 1=Ok, 2=Error"`
	Limit        int    `json:"limit,omitempty" jsonschema:"Maximum number of spans to return (default: 10)"`
	Offset       int    `json:"offset,omitempty" jsonschema:"Number of spans to skip for pagination (default: 0)"`
}
type mcpGetSpanMetricsOverTimeInput struct {
	mcpCommonFilters
	RootSpanName string `json:"root_span_name" jsonschema:"Name of the root span to query"`
	SpanStatuses []int  `json:"span_statuses,omitempty" jsonschema:"Filter by span status: 0=Unset, 1=Ok, 2=Error"`
	Timezone     string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetTraceInput struct {
	AppID   string `json:"app_id" jsonschema:"UUID of the app"`
	TraceID string `json:"trace_id" jsonschema:"ID of the trace"`
}
type mcpGetAlertsInput struct {
	AppID  string `json:"app_id" jsonschema:"UUID of the app to query"`
	From   string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To     string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	Limit  int    `json:"limit,omitempty" jsonschema:"Maximum number of alerts to return (default: 25)"`
	Offset int    `json:"offset,omitempty" jsonschema:"Number of alerts to skip for pagination (default: 0)"`
}
type mcpGetJourneyInput struct {
	AppID        string   `json:"app_id" jsonschema:"UUID of the app to query"`
	From         string   `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To           string   `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	Versions     []string `json:"versions,omitempty" jsonschema:"Filter by app version strings"`
	VersionCodes []string `json:"version_codes,omitempty" jsonschema:"Filter by app version codes"`
}
type mcpGetErrorCommonPathInput struct {
	AppID        string `json:"app_id" jsonschema:"UUID of the app to query"`
	Type         string `json:"type" jsonschema:"Error type: crash or anr"`
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
}
type mcpUpdateBugReportStatusInput struct {
	AppID       string `json:"app_id" jsonschema:"UUID of the app"`
	BugReportID string `json:"bug_report_id" jsonschema:"ID of the bug report"`
	Status      *int   `json:"status" jsonschema:"New status: 0 (closed) or 1 (open)"`
}

// Network tool input structs.
type mcpNetworkFilters struct {
	mcpCommonFilters
	HttpMethods []string `json:"http_methods,omitempty" jsonschema:"Filter by HTTP methods (e.g. get, post)"`
}
type mcpGetUniqueDomainsInput struct {
	AppID string `json:"app_id" jsonschema:"UUID of the app"`
	From  string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To    string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
}
type mcpGetPathsForDomainInput struct {
	AppID  string `json:"app_id" jsonschema:"UUID of the app"`
	Domain string `json:"domain" jsonschema:"Domain to fetch paths for"`
	Search string `json:"search,omitempty" jsonschema:"Search term to filter paths"`
	From   string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To     string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
}
type mcpGetNetworkTrendsInput struct {
	mcpNetworkFilters
	Limit int `json:"limit,omitempty" jsonschema:"Maximum number of endpoints to return per category (1-50, default 10)"`
}
type mcpGetAppHttpStatusCodesOverTimeInput struct {
	mcpNetworkFilters
	Timezone string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetHttpEndpointLatencyOverTimeInput struct {
	mcpNetworkFilters
	Domain   string `json:"domain" jsonschema:"Domain to query (e.g. api.example.com)"`
	Path     string `json:"path" jsonschema:"Path to query (e.g. /v1/users)"`
	Timezone string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetHttpEndpointStatusCodesOverTimeInput struct {
	mcpNetworkFilters
	Domain   string `json:"domain" jsonschema:"Domain to query (e.g. api.example.com)"`
	Path     string `json:"path" jsonschema:"Path to query (e.g. /v1/users)"`
	Timezone string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetNetworkTimelineInput struct {
	mcpNetworkFilters
}
type mcpGetNetworkEndpointTimelineInput struct {
	mcpNetworkFilters
	Domain string `json:"domain" jsonschema:"Domain to query (e.g. api.example.com)"`
	Path   string `json:"path" jsonschema:"Path to query (e.g. /v1/users)"`
}

// --------------------------------------------------------------------------
// Tool helpers
// --------------------------------------------------------------------------

func mcpTextResult(text string) *mcpsdk.CallToolResult {
	return &mcpsdk.CallToolResult{
		Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: text}},
	}
}

// mcpResolveAppAccess validates app_id, checks user access, and returns appID + teamID.
func mcpResolveAppAccess(ctx context.Context, rawAppID string) (uuid.UUID, uuid.UUID, error) {
	userID, ok := mcpUserIDFromContext(ctx)
	if !ok {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("unauthorized: no user in context")
	}

	if rawAppID == "" {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("app_id is required")
	}

	appID, err := uuid.Parse(rawAppID)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("app_id is not a valid UUID")
	}

	pgPool := server.Server.PgPool
	var count int
	err = pgPool.QueryRow(ctx,
		`SELECT count(*)
		 FROM measure.apps a
		 JOIN measure.team_membership tm ON a.team_id = tm.team_id
		 WHERE a.id = $1 AND tm.user_id = $2`,
		appID, userID).Scan(&count)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("failed to check app access: %w", err)
	}
	if count == 0 {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("app not found or access denied")
	}

	app := &App{ID: &appID}
	team, err := app.getTeam(ctx)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("failed to get app team: %v", err)
	}

	return appID, *team.ID, nil
}

// mcpBuildAppFilter populates a filter.AppFilter from mcpCommonFilters.
// When no versions/version_codes are provided, it fetches the latest version
// from the app's filter list (matching frontend behavior).
func mcpBuildAppFilter(ctx context.Context, appID uuid.UUID, cf mcpCommonFilters) (*filter.AppFilter, error) {
	af := &filter.AppFilter{AppID: appID}

	from, to, err := mcpParseTimeRangeStrings(cf.From, cf.To)
	if err != nil {
		return nil, err
	}
	af.From, af.To = from, to

	if len(cf.Versions) > 0 {
		af.Versions = cf.Versions
	}
	if len(cf.VersionCodes) > 0 {
		af.VersionCodes = cf.VersionCodes
	}
	if len(cf.OsNames) > 0 {
		af.OsNames = cf.OsNames
	}
	if len(cf.OsVersions) > 0 {
		af.OsVersions = cf.OsVersions
	}
	if len(cf.Countries) > 0 {
		af.Countries = cf.Countries
	}
	if len(cf.NetworkProviders) > 0 {
		af.NetworkProviders = cf.NetworkProviders
	}
	if len(cf.NetworkTypes) > 0 {
		af.NetworkTypes = cf.NetworkTypes
	}
	if len(cf.NetworkGenerations) > 0 {
		af.NetworkGenerations = cf.NetworkGenerations
	}
	if len(cf.Locales) > 0 {
		af.Locales = cf.Locales
	}
	if len(cf.DeviceManufacturers) > 0 {
		af.DeviceManufacturers = cf.DeviceManufacturers
	}
	if len(cf.DeviceNames) > 0 {
		af.DeviceNames = cf.DeviceNames
	}

	// Default to latest version if none specified.
	if len(af.Versions) == 0 && len(af.VersionCodes) == 0 {
		app, selectErr := SelectApp(ctx, appID)
		if selectErr != nil {
			return nil, fmt.Errorf("failed to fetch default version: %v", selectErr)
		}
		filtersAF := &filter.AppFilter{AppID: appID}
		filtersAF.SetDefaultTimeRange()
		filtersAF.AppOSName = app.OSName
		filterCtx := ambient.WithTeamId(ctx, app.TeamId)

		var fl filter.FilterList
		if err := filtersAF.GetGenericFilters(filterCtx, &fl); err != nil {
			return nil, fmt.Errorf("failed to fetch default version: %v", err)
		}
		if len(fl.Versions) > 0 && len(fl.VersionCodes) > 0 {
			af.Versions = fl.Versions[:1]
			af.VersionCodes = fl.VersionCodes[:1]
		}
	}

	return af, nil
}

// mcpApplySessionFilters sets session-specific filter fields on an AppFilter.
func mcpApplySessionFilters(af *filter.AppFilter, sessionType, freeText string, foreground, background, userInteraction *bool) {
	switch sessionType {
	case "crash":
		af.Crash = true
	case "anr":
		af.ANR = true
	case "issues":
		af.Crash = true
		af.ANR = true
	}

	if freeText != "" {
		af.FreeText = freeText
	}
	if foreground != nil && *foreground {
		af.Foreground = true
	}
	if background != nil && *background {
		af.Background = true
	}
	if userInteraction != nil && *userInteraction {
		af.UserInteraction = true
	}
}

// mcpParseTimeRangeStrings parses optional RFC3339 from/to strings.
// Defaults: from = 7 days ago, to = now.
func mcpParseTimeRangeStrings(fromStr, toStr string) (from, to time.Time, err error) {
	now := time.Now().UTC()
	from = now.AddDate(0, 0, -7)
	to = now

	if fromStr != "" {
		t, parseErr := time.Parse(time.RFC3339, fromStr)
		if parseErr != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("from is not a valid RFC3339 time: %v", parseErr)
		}
		from = t
	}
	if toStr != "" {
		t, parseErr := time.Parse(time.RFC3339, toStr)
		if parseErr != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("to is not a valid RFC3339 time: %v", parseErr)
		}
		to = t
	}
	return
}

// --------------------------------------------------------------------------
// Tool handlers
// --------------------------------------------------------------------------

func mcpListApps(ctx context.Context, _ mcpListAppsInput) (*mcpsdk.CallToolResult, any, error) {
	userID, ok := mcpUserIDFromContext(ctx)
	if !ok {
		return nil, nil, fmt.Errorf("unauthorized: no user in context")
	}

	pgPool := server.Server.PgPool
	type appRow struct {
		ID               string `json:"id"`
		Name             string `json:"name"`
		Platform         string `json:"platform"`
		UniqueIdentifier string `json:"unique_identifier"`
	}
	rows, err := pgPool.Query(ctx,
		`SELECT a.id, a.app_name, coalesce(a.os_name, ''), coalesce(a.unique_identifier, '')
		 FROM measure.apps a
		 JOIN measure.team_membership tm ON a.team_id = tm.team_id
		 WHERE tm.user_id = $1
		 ORDER BY a.created_at DESC`,
		userID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query apps: %v", err)
	}
	defer rows.Close()

	var apps []appRow
	for rows.Next() {
		var row appRow
		if err := rows.Scan(&row.ID, &row.Name, &row.Platform, &row.UniqueIdentifier); err != nil {
			return nil, nil, fmt.Errorf("failed to query apps: %w", err)
		}
		apps = append(apps, row)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	if apps == nil {
		apps = []appRow{}
	}
	data, _ := json.Marshal(apps)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetFilters(ctx context.Context, in mcpGetFiltersInput) (*mcpsdk.CallToolResult, any, error) {
	appID, _, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af := &filter.AppFilter{
		AppID: appID,
		Limit: filter.DefaultPaginationLimit,
	}
	af.SetDefaultTimeRange()

	switch in.Type {
	case "crash":
		af.Crash = true
	case "anr":
		af.ANR = true
	case "span":
		af.Span = true
	case "all", "":
		// no specific filter
	default:
		return nil, nil, fmt.Errorf("type must be 'crash', 'anr', 'span', or 'all'")
	}

	app, err := SelectApp(ctx, appID)
	if err != nil {
		return nil, nil, err
	}
	af.AppOSName = app.OSName
	filterCtx := ambient.WithTeamId(ctx, app.TeamId)

	var fl filter.FilterList
	if err := af.GetGenericFilters(filterCtx, &fl); err != nil {
		return nil, nil, fmt.Errorf("failed to get filters: %v", err)
	}
	data, _ := json.Marshal(fl)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetMetrics(ctx context.Context, in mcpGetMetricsInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset

	app := &App{ID: &appID, TeamId: teamID}
	if err := app.Populate(ctx); err != nil {
		return nil, nil, err
	}
	af.AppOSName = app.OSName
	metricsCtx := ambient.WithTeamId(ctx, teamID)

	adoption, err := app.GetAdoptionMetrics(metricsCtx, af)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch adoption metrics: %w", err)
	}

	excludedVersions, err := af.GetExcludedVersions(metricsCtx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch excluded versions: %w", err)
	}

	crashFree, perceivedCrashFree, anrFree, perceivedANRFree, err := app.GetIssueFreeMetrics(metricsCtx, af, excludedVersions)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch issue free metrics: %w", err)
	}

	launch, err := app.GetLaunchMetrics(metricsCtx, af)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch launch metrics: %w", err)
	}

	result := map[string]any{
		"adoption":                      adoption,
		"crash_free_sessions":           crashFree,
		"perceived_crash_free_sessions": perceivedCrashFree,
		"anr_free_sessions":             anrFree,
		"perceived_anr_free_sessions":   perceivedANRFree,
		"cold_launch": map[string]any{
			"p95":       launch.ColdLaunchP95,
			"delta":     launch.ColdDelta,
			"nan":       launch.ColdNaN,
			"delta_nan": launch.ColdDeltaNaN,
		},
		"warm_launch": map[string]any{
			"p95":       launch.WarmLaunchP95,
			"delta":     launch.WarmDelta,
			"nan":       launch.WarmNaN,
			"delta_nan": launch.WarmDeltaNaN,
		},
		"hot_launch": map[string]any{
			"p95":       launch.HotLaunchP95,
			"delta":     launch.HotDelta,
			"nan":       launch.HotNaN,
			"delta_nan": launch.HotDeltaNaN,
		},
	}

	if len(af.Versions) > 0 && !af.HasMultiVersions() {
		sizes, err := app.GetSizeMetrics(metricsCtx, af, excludedVersions)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to fetch size metrics: %w", err)
		}
		result["sizes"] = sizes
	}

	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetErrors(ctx context.Context, in mcpGetErrorsInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Type == "" {
		return nil, nil, fmt.Errorf("type is required (crash or anr)")
	}
	if in.Type != "crash" && in.Type != "anr" {
		return nil, nil, fmt.Errorf("type must be 'crash' or 'anr'")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset

	if in.Type == "crash" {
		af.Crash = true
	} else {
		af.ANR = true
	}

	app := &App{ID: &appID, TeamId: teamID}
	var data []byte
	if in.Type == "crash" {
		groups, _, _, groupErr := app.GetExceptionGroupsWithFilter(ctx, af)
		if groupErr != nil {
			return nil, nil, fmt.Errorf("failed to get error groups: %v", groupErr)
		}
		data, _ = json.Marshal(groups)
	} else {
		groups, _, _, groupErr := app.GetANRGroupsWithFilter(ctx, af)
		if groupErr != nil {
			return nil, nil, fmt.Errorf("failed to get error groups: %v", groupErr)
		}
		data, _ = json.Marshal(groups)
	}

	return mcpTextResult(string(data)), nil, nil
}

func mcpGetError(ctx context.Context, in mcpGetErrorInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Type == "" {
		return nil, nil, fmt.Errorf("type is required (crash or anr)")
	}
	if in.Type != "crash" && in.Type != "anr" {
		return nil, nil, fmt.Errorf("type must be 'crash' or 'anr'")
	}
	if in.ErrorGroupID == "" {
		return nil, nil, fmt.Errorf("error_group_id is required")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 1
	}
	if limit > 5 {
		limit = 5
	}
	af.Limit = limit
	af.Offset = in.Offset

	app := &App{ID: &appID, TeamId: teamID}
	var data []byte
	if in.Type == "crash" {
		events, _, _, evErr := app.GetExceptionsWithFilter(ctx, in.ErrorGroupID, af)
		if evErr != nil {
			return nil, nil, fmt.Errorf("failed to get error details: %v", evErr)
		}
		data, _ = json.Marshal(events)
	} else {
		events, _, _, evErr := app.GetANRsWithFilter(ctx, in.ErrorGroupID, af)
		if evErr != nil {
			return nil, nil, fmt.Errorf("failed to get error details: %v", evErr)
		}
		data, _ = json.Marshal(events)
	}

	return mcpTextResult(string(data)), nil, nil
}

func mcpGetErrorsOverTime(ctx context.Context, in mcpGetErrorsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Type == "" {
		return nil, nil, fmt.Errorf("type is required (crash or anr)")
	}
	if in.Type != "crash" && in.Type != "anr" {
		return nil, nil, fmt.Errorf("type must be 'crash' or 'anr'")
	}
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit

	if in.Type == "crash" {
		af.Crash = true
	} else {
		af.ANR = true
	}

	app := &App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	var data []byte
	if in.Type == "crash" {
		instances, plotErr := app.GetExceptionPlotInstances(plotCtx, af)
		if plotErr != nil {
			return nil, nil, fmt.Errorf("failed to get error overview plot: %v", plotErr)
		}
		data, _ = json.Marshal(instances)
	} else {
		instances, plotErr := app.GetANRPlotInstances(plotCtx, af)
		if plotErr != nil {
			return nil, nil, fmt.Errorf("failed to get error overview plot: %v", plotErr)
		}
		data, _ = json.Marshal(instances)
	}

	return mcpTextResult(string(data)), nil, nil
}

func mcpGetErrorOverTime(ctx context.Context, in mcpGetErrorOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Type == "" {
		return nil, nil, fmt.Errorf("type is required (crash or anr)")
	}
	if in.Type != "crash" && in.Type != "anr" {
		return nil, nil, fmt.Errorf("type must be 'crash' or 'anr'")
	}
	if in.ErrorGroupID == "" {
		return nil, nil, fmt.Errorf("error_group_id is required")
	}
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit

	app := &App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	var data []byte
	if in.Type == "crash" {
		instances, plotErr := app.GetExceptionGroupPlotInstances(plotCtx, in.ErrorGroupID, af)
		if plotErr != nil {
			return nil, nil, fmt.Errorf("failed to get error detail plot: %v", plotErr)
		}
		data, _ = json.Marshal(instances)
	} else {
		instances, plotErr := app.GetANRGroupPlotInstances(plotCtx, in.ErrorGroupID, af)
		if plotErr != nil {
			return nil, nil, fmt.Errorf("failed to get error detail plot: %v", plotErr)
		}
		data, _ = json.Marshal(instances)
	}

	return mcpTextResult(string(data)), nil, nil
}

func mcpGetErrorDistribution(ctx context.Context, in mcpGetErrorDistributionInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Type == "" {
		return nil, nil, fmt.Errorf("type is required (crash or anr)")
	}
	if in.Type != "crash" && in.Type != "anr" {
		return nil, nil, fmt.Errorf("type must be 'crash' or 'anr'")
	}
	if in.ErrorGroupID == "" {
		return nil, nil, fmt.Errorf("error_group_id is required")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Limit = filter.DefaultPaginationLimit

	app := &App{ID: &appID, TeamId: teamID}
	distCtx := ambient.WithTeamId(ctx, teamID)
	var data []byte
	if in.Type == "crash" {
		distribution, distErr := app.GetExceptionAttributesDistribution(distCtx, in.ErrorGroupID, af)
		if distErr != nil {
			return nil, nil, fmt.Errorf("failed to get error distribution: %v", distErr)
		}
		data, _ = json.Marshal(distribution)
	} else {
		distribution, distErr := app.GetANRAttributesDistribution(distCtx, in.ErrorGroupID, af)
		if distErr != nil {
			return nil, nil, fmt.Errorf("failed to get error distribution: %v", distErr)
		}
		data, _ = json.Marshal(distribution)
	}

	return mcpTextResult(string(data)), nil, nil
}

func mcpGetSessions(ctx context.Context, in mcpGetSessionsInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset

	mcpApplySessionFilters(af, in.SessionType, in.FreeText, in.Foreground, in.Background, in.UserInteraction)

	app := &App{ID: &appID, TeamId: teamID}
	sessCtx := ambient.WithTeamId(ctx, teamID)
	sessions, _, _, sessErr := app.GetSessionsWithFilter(sessCtx, af)
	if sessErr != nil {
		return nil, nil, fmt.Errorf("failed to get session timelines: %v", sessErr)
	}
	data, _ := json.Marshal(sessions)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetSessionsOverTime(ctx context.Context, in mcpGetSessionsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit

	mcpApplySessionFilters(af, in.SessionType, in.FreeText, in.Foreground, in.Background, in.UserInteraction)

	app := &App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetSessionsInstancesPlot(plotCtx, af)
	if plotErr != nil {
		return nil, nil, fmt.Errorf("failed to get session timelines plot: %v", plotErr)
	}
	data, _ := json.Marshal(instances)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetSession(ctx context.Context, in mcpGetSessionInput) (*mcpsdk.CallToolResult, any, error) {
	if in.SessionID == "" {
		return nil, nil, fmt.Errorf("session_id is required")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	sessionUUID, parseErr := uuid.Parse(in.SessionID)
	if parseErr != nil {
		return nil, nil, fmt.Errorf("session_id is not a valid UUID")
	}
	app := &App{ID: &appID, TeamId: teamID}
	session, sessErr := app.GetSessionEvents(ctx, sessionUUID)
	if sessErr != nil {
		return nil, nil, fmt.Errorf("failed to get session details: %v", sessErr)
	}
	data, _ := json.Marshal(session)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetBugReports(ctx context.Context, in mcpGetBugReportsInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset
	af.BugReport = true

	if in.FreeText != "" {
		af.FreeText = in.FreeText
	}
	if len(in.BugReportStatuses) > 0 {
		statuses := make([]int8, len(in.BugReportStatuses))
		for i, s := range in.BugReportStatuses {
			statuses[i] = int8(s)
		}
		af.BugReportStatuses = statuses
	}

	app := &App{ID: &appID, TeamId: teamID}
	bugCtx := ambient.WithTeamId(ctx, teamID)
	bugReports, _, _, bugErr := app.GetBugReportsWithFilter(bugCtx, af)
	if bugErr != nil {
		return nil, nil, fmt.Errorf("failed to get bug reports: %v", bugErr)
	}
	data, _ := json.Marshal(bugReports)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetBugReportsOverTime(ctx context.Context, in mcpGetBugReportsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit
	af.BugReport = true

	if len(in.BugReportStatuses) > 0 {
		statuses := make([]int8, len(in.BugReportStatuses))
		for i, s := range in.BugReportStatuses {
			statuses[i] = int8(s)
		}
		af.BugReportStatuses = statuses
	}

	app := &App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetBugReportInstancesPlot(plotCtx, af)
	if plotErr != nil {
		return nil, nil, fmt.Errorf("failed to get bug reports plot: %v", plotErr)
	}
	data, _ := json.Marshal(instances)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetBugReport(ctx context.Context, in mcpGetBugReportInput) (*mcpsdk.CallToolResult, any, error) {
	if in.BugReportID == "" {
		return nil, nil, fmt.Errorf("bug_report_id is required")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	app := &App{ID: &appID, TeamId: teamID}
	bugReport, bugErr := app.GetBugReportById(ctx, in.BugReportID)
	if bugErr != nil {
		return nil, nil, fmt.Errorf("failed to get bug report details: %v", bugErr)
	}
	data, _ := json.Marshal(bugReport)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetRootSpanNames(ctx context.Context, in mcpGetRootSpanNamesInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	app := &App{ID: &appID, TeamId: teamID}
	names, spanErr := app.FetchRootSpanNames(ctx)
	if spanErr != nil {
		return nil, nil, fmt.Errorf("failed to get root span names: %v", spanErr)
	}
	if names == nil {
		names = []string{}
	}
	data, _ := json.Marshal(names)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetSpanInstances(ctx context.Context, in mcpGetSpanInstancesInput) (*mcpsdk.CallToolResult, any, error) {
	if in.RootSpanName == "" {
		return nil, nil, fmt.Errorf("root_span_name is required")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset
	af.Span = true

	if len(in.SpanStatuses) > 0 {
		statuses := make([]int8, len(in.SpanStatuses))
		for i, s := range in.SpanStatuses {
			statuses[i] = int8(s)
		}
		af.SpanStatuses = statuses
	}

	app := &App{ID: &appID, TeamId: teamID}
	spanCtx := ambient.WithTeamId(ctx, teamID)
	spans, _, _, spanErr := app.GetSpansForSpanNameWithFilter(spanCtx, in.RootSpanName, af)
	if spanErr != nil {
		return nil, nil, fmt.Errorf("failed to get span instances: %v", spanErr)
	}
	data, _ := json.Marshal(spans)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetSpanMetricsOverTime(ctx context.Context, in mcpGetSpanMetricsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	if in.RootSpanName == "" {
		return nil, nil, fmt.Errorf("root_span_name is required")
	}
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit
	af.Span = true

	if len(in.SpanStatuses) > 0 {
		statuses := make([]int8, len(in.SpanStatuses))
		for i, s := range in.SpanStatuses {
			statuses[i] = int8(s)
		}
		af.SpanStatuses = statuses
	}

	app := &App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetMetricsPlotForSpanNameWithFilter(plotCtx, in.RootSpanName, af)
	if plotErr != nil {
		return nil, nil, fmt.Errorf("failed to get span metrics plot: %v", plotErr)
	}
	data, _ := json.Marshal(instances)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetTrace(ctx context.Context, in mcpGetTraceInput) (*mcpsdk.CallToolResult, any, error) {
	if in.TraceID == "" {
		return nil, nil, fmt.Errorf("trace_id is required")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	app := &App{ID: &appID, TeamId: teamID}
	trace, traceErr := app.GetTrace(ctx, in.TraceID)
	if traceErr != nil {
		return nil, nil, fmt.Errorf("failed to get trace details: %v", traceErr)
	}
	data, _ := json.Marshal(trace)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetAlerts(ctx context.Context, in mcpGetAlertsInput) (*mcpsdk.CallToolResult, any, error) {
	appID, _, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af := &filter.AppFilter{AppID: appID}

	from, to, parseErr := mcpParseTimeRangeStrings(in.From, in.To)
	if parseErr != nil {
		return nil, nil, parseErr
	}
	af.From, af.To = from, to

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset

	alerts, _, _, alertErr := GetAlertsWithFilter(ctx, af)
	if alertErr != nil {
		return nil, nil, fmt.Errorf("failed to get alerts: %v", alertErr)
	}
	data, _ := json.Marshal(alerts)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetJourney(ctx context.Context, in mcpGetJourneyInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	cf := mcpCommonFilters{
		AppID:        in.AppID,
		From:         in.From,
		To:           in.To,
		Versions:     in.Versions,
		VersionCodes: in.VersionCodes,
	}
	af, err := mcpBuildAppFilter(ctx, appID, cf)
	if err != nil {
		return nil, nil, err
	}
	af.Limit = filter.DefaultPaginationLimit

	app := &App{ID: &appID, TeamId: teamID}
	if err := app.Populate(ctx); err != nil {
		return nil, nil, err
	}
	journeyCtx := ambient.WithTeamId(ctx, teamID)

	opts := filter.JourneyOpts{All: true}
	journeyEvents, journeyErr := app.getJourneyEvents(journeyCtx, af, opts)
	if journeyErr != nil {
		return nil, nil, fmt.Errorf("failed to get journey: %v", journeyErr)
	}

	type journeyNode struct {
		Source string `json:"source"`
		Target string `json:"target"`
		Value  int    `json:"value"`
	}

	type result struct {
		Nodes []string      `json:"nodes"`
		Links []journeyNode `json:"links"`
	}

	nodeSet := make(map[string]bool)
	var links []journeyNode

	for i := 1; i < len(journeyEvents); i++ {
		src := journeyEvents[i-1].Type
		tgt := journeyEvents[i].Type
		nodeSet[src] = true
		nodeSet[tgt] = true
		links = append(links, journeyNode{Source: src, Target: tgt, Value: 1})
	}

	var nodes []string
	for n := range nodeSet {
		nodes = append(nodes, n)
	}

	data, _ := json.Marshal(result{Nodes: nodes, Links: links})
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetErrorCommonPath(ctx context.Context, in mcpGetErrorCommonPathInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Type == "" {
		return nil, nil, fmt.Errorf("type is required (crash or anr)")
	}
	if in.Type != "crash" && in.Type != "anr" {
		return nil, nil, fmt.Errorf("type must be 'crash' or 'anr'")
	}
	if in.ErrorGroupID == "" {
		return nil, nil, fmt.Errorf("error_group_id is required")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	gt := group.GroupType(in.Type)
	data, pathErr := GetIssueGroupCommonPath(ctx, teamID, appID, gt, in.ErrorGroupID)
	if pathErr != nil {
		return nil, nil, fmt.Errorf("failed to get error common path: %v", pathErr)
	}

	return mcpTextResult(string(data)), nil, nil
}

func mcpUpdateBugReportStatus(ctx context.Context, in mcpUpdateBugReportStatusInput) (*mcpsdk.CallToolResult, any, error) {
	if in.BugReportID == "" {
		return nil, nil, fmt.Errorf("bug_report_id is required")
	}
	if in.Status == nil {
		return nil, nil, fmt.Errorf("status is required (0 for closed, 1 for open)")
	}
	status := *in.Status
	if status != 0 && status != 1 {
		return nil, nil, fmt.Errorf("status must be 0 (closed) or 1 (open)")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	app := &App{ID: &appID, TeamId: teamID}
	if err := app.UpdateBugReportStatusById(ctx, in.BugReportID, uint8(status)); err != nil {
		return nil, nil, fmt.Errorf("failed to update bug report status: %v", err)
	}

	return mcpTextResult(`{"ok":"done"}`), nil, nil
}

// --------------------------------------------------------------------------
// Network tool helpers & handlers
// --------------------------------------------------------------------------

func mcpBuildNetworkFilter(ctx context.Context, appID uuid.UUID, nf mcpNetworkFilters) (*filter.AppFilter, error) {
	af, err := mcpBuildAppFilter(ctx, appID, nf.mcpCommonFilters)
	if err != nil {
		return nil, err
	}
	if len(nf.HttpMethods) > 0 {
		af.HttpMethods = nf.HttpMethods
	}
	return af, nil
}

func mcpGetUniqueDomains(ctx context.Context, in mcpGetUniqueDomainsInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	from, to, err := mcpParseTimeRangeStrings(in.From, in.To)
	if err != nil {
		return nil, nil, err
	}

	domains, err := network.FetchDomains(ctx, appID, teamID, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network domains: %v", err)
	}
	if domains == nil {
		domains = []string{}
	}
	data, _ := json.Marshal(domains)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetPathsForDomain(ctx context.Context, in mcpGetPathsForDomainInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Domain == "" {
		return nil, nil, fmt.Errorf("domain is required")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	from, to, err := mcpParseTimeRangeStrings(in.From, in.To)
	if err != nil {
		return nil, nil, err
	}

	paths, err := network.FetchPaths(ctx, appID, teamID, in.Domain, in.Search, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network paths: %v", err)
	}
	if paths == nil {
		paths = []string{}
	}
	data, _ := json.Marshal(paths)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetNetworkTrends(ctx context.Context, in mcpGetNetworkTrendsInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	result, err := network.FetchTrends(ctx, appID, teamID, af, limit)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network trends: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetAppStatusCodesOverTime(ctx context.Context, in mcpGetAppHttpStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.SetDefaultPlotTimeGroup()

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to compute time group expression: %v", err)
	}

	result, err := network.GetNetworkOverviewStatusCodesPlot(ctx, appID, teamID, af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network status overview over time: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetHttpEndpointLatencyOverTime(ctx context.Context, in mcpGetHttpEndpointLatencyOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Domain == "" {
		return nil, nil, fmt.Errorf("domain is required")
	}
	if in.Path == "" {
		return nil, nil, fmt.Errorf("path is required")
	}
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	domain := in.Domain
	path := in.Path

	af, err := mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.SetDefaultPlotTimeGroup()

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to compute time group expression: %v", err)
	}

	result, err := network.GetEndpointLatencyPlot(ctx, appID, teamID, domain, path, af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network latency over time: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetHttpEndpointStatusCodesOverTime(ctx context.Context, in mcpGetHttpEndpointStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Domain == "" {
		return nil, nil, fmt.Errorf("domain is required")
	}
	if in.Path == "" {
		return nil, nil, fmt.Errorf("path is required")
	}
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	domain := in.Domain
	path := in.Path

	af, err := mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.SetDefaultPlotTimeGroup()

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to compute time group expression: %v", err)
	}

	result, err := network.GetEndpointStatusCodesPlot(ctx, appID, teamID, domain, path, af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network status distribution over time: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetNetworkTimeline(ctx context.Context, in mcpGetNetworkTimelineInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}

	result, err := network.FetchOverviewTimeline(ctx, appID, teamID, af, 0)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network request timeline: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func mcpGetNetworkEndpointTimeline(ctx context.Context, in mcpGetNetworkEndpointTimelineInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, err := mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	if in.Domain == "" {
		return nil, nil, fmt.Errorf("domain is required")
	}
	if in.Path == "" {
		return nil, nil, fmt.Errorf("path is required")
	}

	domain := in.Domain
	path := in.Path

	af, err := mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}

	result, err := network.FetchEndpointTimeline(ctx, appID, teamID, domain, path, af)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network endpoint timeline: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}
