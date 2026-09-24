package mcp

import (
	"backend/agent/agent"
	"backend/agent/server"
	"backend/libs/authsession"
	"backend/libs/measure"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"slices"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"github.com/valkey-io/valkey-go"
)

// --------------------------------------------------------------------------
// Constants & Types
// --------------------------------------------------------------------------

const (
	// mcpAuthCodeTTL is the lifetime of an MCP authorization code.
	mcpAuthCodeTTL = 10 * time.Minute
	// mcpTokenExpiry is the lifetime of an MCP access token.
	mcpTokenExpiry = 30 * time.Minute
	// mcpRefreshTokenExpiry is how long a refresh token stays valid once issued
	mcpRefreshTokenExpiry = 90 * 24 * time.Hour
	// mcpRefreshReuseWindow is how long the refresh token replaced by a
	// rotation still returns the current pair, so a client sending several
	// refreshes with the same token at once doesn't end its own session.
	mcpRefreshReuseWindow = 10 * time.Second
	// mcpValkeyStateTTL is the Valkey TTL for OAuth state.
	mcpValkeyStateTTL = 600 * time.Second
	// mcpProviderTokenCheckInterval is how often a refresh re-validates the
	// third-party OAuth provider token bound to an MCP session.
	mcpProviderTokenCheckInterval = 1 * time.Hour
)

// mcpHTTPError is returned by MCP functions to communicate the HTTP status
// code back to the calling Gin handler. OAuthError, when set, is the RFC 6749
// error code clients key their re-authorization on.
type mcpHTTPError struct {
	Status     int
	Message    string
	OAuthError string
}

func (e *mcpHTTPError) Error() string { return e.Message }

func mcpInvalidGrant(msg string) error {
	return &mcpHTTPError{Status: http.StatusBadRequest, Message: msg, OAuthError: "invalid_grant"}
}

// mcpAbortWithError ends the request with the status carried by err. Errors
// that are not *mcpHTTPError carry no status, so they become a 500 with the
// real cause logged rather than sent to the client.
func mcpAbortWithError(c *gin.Context, err error) {
	var herr *mcpHTTPError
	if errors.As(err, &herr) {
		if herr.OAuthError != "" {
			c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.OAuthError, "error_description": herr.Message})
			return
		}
		c.AbortWithStatusJSON(herr.Status, gin.H{"error": herr.Message})
		return
	}

	fmt.Printf("mcp: unexpected error on %s: %v\n", c.Request.URL.Path, err)
	c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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

type mcpSession struct {
	ID                     uuid.UUID
	UserID                 uuid.UUID
	ClientID               string
	Provider               *string
	ProviderToken          *string
	ProviderTokenCheckedAt *time.Time
	RefreshTokenID         uuid.UUID
	PrevRefreshTokenID     *uuid.UUID
	RotatedAt              *time.Time
	AccessExpiresAt        time.Time
	RefreshExpiresAt       time.Time
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

// mcpResourceURL is the OAuth resource identifier MCP tokens are issued for.
func mcpResourceURL(apiOrigin string) string {
	return apiOrigin + "/mcp"
}

func mcpResourceMetadataURL(apiOrigin string) string {
	return apiOrigin + "/.well-known/oauth-protected-resource/mcp"
}

// mcpOAuthMetadata returns the RFC 8414 authorization server metadata map.
// Clients register by presenting a Client ID Metadata Document URL, or through
// the registration endpoint if they do not support that yet.
func mcpOAuthMetadata(apiOrigin string) map[string]any {
	return map[string]any{
		"issuer":                                         apiOrigin,
		"authorization_endpoint":                         apiOrigin + "/oauth/authorize",
		"token_endpoint":                                 apiOrigin + "/oauth/token",
		"response_types_supported":                       []string{"code"},
		"grant_types_supported":                          []string{"authorization_code", "refresh_token"},
		"code_challenge_methods_supported":               []string{"S256"},
		"registration_endpoint":                          apiOrigin + "/oauth/register",
		"token_endpoint_auth_methods_supported":          []string{"none"},
		"client_id_metadata_document_supported":          true,
		"authorization_response_iss_parameter_supported": true,
	}
}

// mcpProtectedResourceMetadata returns the RFC 9728 protected resource metadata map.
func mcpProtectedResourceMetadata(apiOrigin, resource string) map[string]any {
	return map[string]any{
		"resource":                 resource,
		"authorization_servers":    []string{apiOrigin},
		"bearer_methods_supported": []string{"header"},
	}
}

// mcpValidateResource checks the RFC 8707 resource parameter. It is optional
// because clients on older protocol revisions do not send one.
func mcpValidateResource(apiOrigin, resource string) error {
	if resource == "" {
		return nil
	}
	trimmed := strings.TrimSuffix(resource, "/")
	if trimmed == apiOrigin || trimmed == mcpResourceURL(apiOrigin) {
		return nil
	}
	return &mcpHTTPError{Status: http.StatusBadRequest, Message: "resource does not identify this MCP server", OAuthError: "invalid_target"}
}

// mcpClientMetadata is the part of a Client ID Metadata Document that is checked.
type mcpClientMetadata struct {
	ClientID     string   `json:"client_id"`
	RedirectURIs []string `json:"redirect_uris"`
}

const mcpClientMetadataMaxBytes = 64 << 10

// mcpClientMetadataHTTPClient fetches documents from URLs an unauthenticated
// caller chooses, so it follows no redirects, refuses non-public addresses and
// keeps no idle connections.
var mcpClientMetadataHTTPClient = mcpNewClientMetadataHTTPClient(mcpRefuseNonPublicDial, nil)

func mcpNewClientMetadataHTTPClient(dialControl func(network, address string, c syscall.RawConn) error, tlsConfig *tls.Config) *http.Client {
	return &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
		Transport: &http.Transport{
			DialContext: (&net.Dialer{
				Timeout: 3 * time.Second,
				Control: dialControl,
			}).DialContext,
			TLSClientConfig:   tlsConfig,
			DisableKeepAlives: true,
		},
	}
}

// mcpNonPublicPrefixes are the address ranges the metadata fetch must never
// reach, including the ones the standard library's IsPrivate does not cover.
var mcpNonPublicPrefixes = func() []netip.Prefix {
	var prefixes []netip.Prefix
	for _, p := range []string{
		"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
		"172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "198.18.0.0/15",
		"198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
		"::/128", "::1/128", "64:ff9b::/96", "64:ff9b:1::/48", "100::/64", "2001::/32",
		"2001:db8::/32", "2002::/16", "fc00::/7", "fe80::/10", "fec0::/10", "ff00::/8",
	} {
		prefixes = append(prefixes, netip.MustParsePrefix(p))
	}
	return prefixes
}()

// mcpRefuseNonPublicDial runs after DNS resolution on the address about to be
// dialed, so a hostname that resolves to an internal address is refused too.
func mcpRefuseNonPublicDial(_, address string, _ syscall.RawConn) error {
	addrPort, err := netip.ParseAddrPort(address)
	if err != nil {
		return err
	}
	if !mcpIsPublicAddr(addrPort.Addr()) {
		return fmt.Errorf("refusing to dial non-public address %s", addrPort.Addr())
	}
	return nil
}

func mcpIsPublicAddr(addr netip.Addr) bool {
	addr = addr.Unmap()
	for _, p := range mcpNonPublicPrefixes {
		if p.Contains(addr) {
			return false
		}
	}
	return true
}

// mcpIsClientMetadataURL reports whether a client_id is a Client ID Metadata Document URL.
func mcpIsClientMetadataURL(clientID string) bool {
	return strings.HasPrefix(clientID, "https://")
}

// mcpValidateClientID checks the shape of a Client ID Metadata Document URL
// without fetching it.
func mcpValidateClientID(clientID string) error {
	u, parseErr := url.Parse(clientID)
	if parseErr != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Fragment != "" || u.Path == "" || u.Path == "/" {
		return &mcpHTTPError{Status: http.StatusBadRequest, Message: "client_id must be an https URL with a path"}
	}
	for seg := range strings.SplitSeq(u.Path, "/") {
		if seg == "." || seg == ".." {
			return &mcpHTTPError{Status: http.StatusBadRequest, Message: "client_id must not contain dot path segments"}
		}
	}
	return nil
}

// mcpFetchClientMetadata resolves a client_id given as the URL of a Client ID
// Metadata Document. The document is self-published, so it is accepted only if
// its own client_id field matches the URL it was fetched from.
func mcpFetchClientMetadata(ctx context.Context, clientID string) (mcpClientMetadata, error) {
	if err := mcpValidateClientID(clientID); err != nil {
		return mcpClientMetadata{}, err
	}

	req, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, clientID, nil)
	if reqErr != nil {
		return mcpClientMetadata{}, &mcpHTTPError{Status: http.StatusBadRequest, Message: "invalid client_id"}
	}
	req.Header.Set("Accept", "application/json")
	resp, doErr := mcpClientMetadataHTTPClient.Do(req)
	if doErr != nil {
		fmt.Printf("mcp: failed to fetch client metadata %s: %v\n", clientID, doErr)
		return mcpClientMetadata{}, &mcpHTTPError{Status: http.StatusBadRequest, Message: "failed to fetch client metadata"}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return mcpClientMetadata{}, &mcpHTTPError{Status: http.StatusBadRequest, Message: "client metadata URL did not return 200"}
	}
	body, readErr := io.ReadAll(io.LimitReader(resp.Body, mcpClientMetadataMaxBytes+1))
	if readErr != nil || len(body) > mcpClientMetadataMaxBytes {
		return mcpClientMetadata{}, &mcpHTTPError{Status: http.StatusBadRequest, Message: "failed to read client metadata"}
	}

	var meta mcpClientMetadata
	if jsonErr := json.Unmarshal(body, &meta); jsonErr != nil {
		return mcpClientMetadata{}, &mcpHTTPError{Status: http.StatusBadRequest, Message: "client metadata is not valid JSON"}
	}
	if meta.ClientID != clientID {
		return mcpClientMetadata{}, &mcpHTTPError{Status: http.StatusBadRequest, Message: "client metadata client_id does not match its URL"}
	}
	if len(meta.RedirectURIs) == 0 {
		return mcpClientMetadata{}, &mcpHTTPError{Status: http.StatusBadRequest, Message: "client metadata has no redirect_uris"}
	}
	return meta, nil
}

// mcpRegisterClient dynamically registers an OAuth client.
func mcpRegisterClient(ctx context.Context, deps *server.Deps, clientName string, redirectURIs []string) (clientID string, err error) {
	pgPool := deps.PgPool

	clientIDBuf := make([]byte, 8)
	if _, randErr := rand.Read(clientIDBuf); randErr != nil {
		return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to generate client id"}
	}
	clientID = "msr_client_" + hex.EncodeToString(clientIDBuf)

	stmt := sqlf.PostgreSQL.
		InsertInto("mcp_clients").
		Set("client_id", clientID).
		Set("client_name", clientName).
		Set("redirect_uris", redirectURIs)
	defer stmt.Close()

	if _, dbErr := pgPool.Exec(ctx, stmt.String(), stmt.Args()...); dbErr != nil {
		return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to register client"}
	}

	return clientID, nil
}

// mcpClientRedirectURIs returns the redirect URIs a client may use, from its
// metadata document or from its registration.
func mcpClientRedirectURIs(ctx context.Context, deps *server.Deps, clientID string) ([]string, error) {
	if mcpIsClientMetadataURL(clientID) {
		meta, err := mcpFetchClientMetadata(ctx, clientID)
		if err != nil {
			return nil, err
		}
		return meta.RedirectURIs, nil
	}

	stmt := sqlf.PostgreSQL.
		From("mcp_clients").
		Select("redirect_uris").
		Where("client_id = ?", clientID)
	defer stmt.Close()

	var registeredURIs []string
	dbErr := deps.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&registeredURIs)
	if errors.Is(dbErr, pgx.ErrNoRows) {
		return nil, &mcpHTTPError{Status: http.StatusBadRequest, Message: "unknown client_id"}
	}
	if dbErr != nil {
		fmt.Printf("mcp: failed to look up client: %v\n", dbErr)
		return nil, &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to look up client"}
	}
	return registeredURIs, nil
}

// mcpRedirectURIAllowed ignores the port on loopback URIs because native
// clients such as Claude Code bind an ephemeral port for each authorization.
func mcpRedirectURIAllowed(requested string, registered []string) bool {
	if slices.Contains(registered, requested) {
		return true
	}
	ru, err := url.Parse(requested)
	if err != nil || !mcpIsLoopbackHost(ru.Hostname()) {
		return false
	}
	for _, r := range registered {
		cu, err := url.Parse(r)
		if err != nil {
			continue
		}
		if cu.Scheme == ru.Scheme && cu.Hostname() == ru.Hostname() && cu.Path == ru.Path &&
			cu.RawQuery == ru.RawQuery && cu.Fragment == ru.Fragment && cu.User == nil && ru.User == nil {
			return true
		}
	}
	return false
}

// mcpAppendRedirectParams adds the authorization response parameters to a
// redirect URI, keeping any query string the client registered.
func mcpAppendRedirectParams(redirectURI string, params url.Values) (string, error) {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return "", err
	}
	q := u.Query()
	for k, vs := range params {
		for _, v := range vs {
			q.Set(k, v)
		}
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func mcpIsLoopbackHost(host string) bool {
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

// mcpAuthorize stores OAuth state in Valkey and returns the provider OAuth
// redirect URL.
func mcpAuthorize(ctx context.Context, deps *server.Deps, provider, clientID, redirectURI, mcpState, codeChallenge string) (providerURL string, err error) {
	vk := deps.VK
	siteOrigin := deps.Config.SiteOrigin

	if provider != "github" && provider != "google" {
		return "", &mcpHTTPError{Status: http.StatusBadRequest, Message: "unsupported provider"}
	}

	stateBuf := make([]byte, 16)
	if _, randErr := rand.Read(stateBuf); randErr != nil {
		return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to generate state"}
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
		return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to store state"}
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
		return "", &mcpHTTPError{Status: http.StatusBadRequest, Message: "unsupported provider"}
	}
}

// mcpCallback exchanges an OAuth code for a token, finds or creates the
// Measure user, inserts an MCP auth code, and returns the redirect URL
// for the MCP client.
func mcpCallback(ctx context.Context, deps *server.Deps, code, state string) (redirectURL string, err error) {
	pgPool := deps.PgPool
	vk := deps.VK
	siteOrigin := deps.Config.SiteOrigin

	// GETDEL so concurrent callbacks can't both consume the same state & then
	// exchange the same single-use provider code.
	key := mcpValkeyStateKey(state)
	val, vkErr := vk.Do(ctx, vk.B().Getdel().Key(key).Build()).ToString()
	if vkErr != nil {
		return "", &mcpHTTPError{Status: http.StatusBadRequest, Message: "unknown or expired state"}
	}

	var statePayload mcpOAuthStatePayload
	if jsonErr := json.Unmarshal([]byte(val), &statePayload); jsonErr != nil {
		return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to decode state"}
	}

	if code == "" {
		return "", &mcpHTTPError{Status: http.StatusBadRequest, Message: "missing code"}
	}

	var userName, userEmail string
	var providerName, providerToken string

	callbackURL := siteOrigin + "/auth/callback/" + statePayload.Provider

	switch statePayload.Provider {
	case "github":
		ghToken, exchErr := mcpExchangeGitHubCodeFn(code, callbackURL, deps.Config.OAuthGitHubKey, deps.Config.OAuthGitHubSecret)
		if exchErr != nil {
			fmt.Println("mcp: failed to exchange github code:", exchErr)
			if errors.Is(exchErr, authsession.ErrInvalidOAuthCode) {
				return "", &mcpHTTPError{Status: http.StatusBadRequest, Message: "invalid or expired GitHub code"}
			}
			return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to exchange GitHub code"}
		}

		u, userErr := mcpGetGitHubUserFn(ghToken)
		if userErr != nil {
			fmt.Println("mcp: failed to get github user info:", userErr)
			return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to get GitHub user"}
		}

		userName = u.Name
		userEmail = u.Email
		providerName = "github"
		providerToken = ghToken

	case "google":
		refreshToken, idToken, exchErr := mcpExchangeGoogleCodeFn(code, callbackURL, deps.Config.OAuthGoogleKey, deps.Config.OAuthGoogleSecret)
		if exchErr != nil {
			fmt.Println("mcp: failed to exchange google code:", exchErr)
			if errors.Is(exchErr, authsession.ErrInvalidOAuthCode) {
				return "", &mcpHTTPError{Status: http.StatusBadRequest, Message: "invalid or expired Google code"}
			}
			return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to exchange Google code"}
		}

		gUser, userErr := mcpGetGoogleUserFromIDTokenFn(idToken)
		if userErr != nil {
			fmt.Println("mcp: failed to get google user info:", userErr)
			return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to get Google user info"}
		}

		userName = gUser.Name
		userEmail = gUser.Email
		providerName = "google"
		providerToken = refreshToken

	default:
		return "", &mcpHTTPError{Status: http.StatusBadRequest, Message: "unsupported provider in state"}
	}

	msrUser, fcErr := mcpFindOrCreateUser(ctx, deps, userName, userEmail)
	if fcErr != nil {
		return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to find or create user"}
	}

	authCodeBuf := make([]byte, 32)
	if _, randErr := rand.Read(authCodeBuf); randErr != nil {
		return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to generate auth code"}
	}
	authCode := hex.EncodeToString(authCodeBuf)
	expiresAt := time.Now().Add(mcpAuthCodeTTL)

	stmt := sqlf.PostgreSQL.
		InsertInto("mcp_auth_codes").
		Set("code", authCode).
		Set("user_id", msrUser.ID).
		Set("client_id", statePayload.ClientID).
		Set("redirect_uri", statePayload.RedirectURI).
		Set("code_challenge", statePayload.CodeChallenge).
		Set("provider", providerName).
		Set("provider_token", providerToken).
		Set("expires_at", expiresAt)
	defer stmt.Close()

	if _, dbErr := pgPool.Exec(ctx, stmt.String(), stmt.Args()...); dbErr != nil {
		return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to create auth code"}
	}

	redirectParams := url.Values{}
	redirectParams.Set("code", authCode)
	redirectParams.Set("iss", deps.Config.AgentOrigin)
	if statePayload.MCPState != "" {
		redirectParams.Set("state", statePayload.MCPState)
	}
	redirectURL, urlErr := mcpAppendRedirectParams(statePayload.RedirectURI, redirectParams)
	if urlErr != nil {
		return "", &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to build redirect URL"}
	}
	return redirectURL, nil
}

type mcpTokenPair struct {
	AccessToken  string
	RefreshToken string
}

type mcpTokenGrant struct {
	UserID                 uuid.UUID
	ClientID               string
	Provider               *string
	ProviderToken          *string
	ProviderTokenCheckedAt *time.Time
}

// mcpSignTokenPair signs an access token and a refresh token for one session.
// mcpRefresh accepts a token whose jti matches the session's rt_jti, which is
// the refresh token's, so the access token is signed with a jti of its own and
// cannot be exchanged for a new pair.
func mcpSignTokenPair(deps *server.Deps, grantID, refreshTokenID, userID uuid.UUID, atExpiry, rtExpiry time.Time) (mcpTokenPair, error) {
	if signErr := mcpCheckSigningSecrets(deps); signErr != nil {
		return mcpTokenPair{}, signErr
	}
	accessToken, atErr := authsession.CreateAccessToken(deps.Config.AccessTokenSecret, uuid.New(), grantID, userID, atExpiry, authsession.AudienceMCP)
	if atErr != nil {
		return mcpTokenPair{}, &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to generate token"}
	}
	refreshToken, rtErr := authsession.CreateRefreshToken(deps.Config.RefreshTokenSecret, refreshTokenID, grantID, rtExpiry, authsession.AudienceMCP)
	if rtErr != nil {
		return mcpTokenPair{}, &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to generate token"}
	}
	return mcpTokenPair{AccessToken: accessToken, RefreshToken: refreshToken}, nil
}

func mcpStartSession(ctx context.Context, deps *server.Deps, grant mcpTokenGrant, tx *pgx.Tx) (mcpTokenPair, error) {
	grantID := uuid.New()
	refreshTokenID := uuid.New()
	now := time.Now()
	atExpiry := now.Add(mcpTokenExpiry)
	rtExpiry := now.Add(mcpRefreshTokenExpiry)

	pair, signErr := mcpSignTokenPair(deps, grantID, refreshTokenID, grant.UserID, atExpiry, rtExpiry)
	if signErr != nil {
		return mcpTokenPair{}, signErr
	}

	checkedAt := now
	if grant.ProviderTokenCheckedAt != nil {
		checkedAt = *grant.ProviderTokenCheckedAt
	}
	stmt := sqlf.PostgreSQL.
		InsertInto("mcp_auth_sessions").
		Set("id", grantID).
		Set("user_id", grant.UserID).
		Set("client_id", grant.ClientID).
		Set("provider", grant.Provider).
		Set("provider_token", grant.ProviderToken).
		Set("provider_token_checked_at", checkedAt).
		Set("rt_jti", refreshTokenID).
		Set("at_expiry_at", atExpiry).
		Set("rt_expiry_at", rtExpiry)
	defer stmt.Close()

	var insErr error
	if tx != nil {
		_, insErr = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
	} else {
		_, insErr = deps.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	}
	if insErr != nil {
		return mcpTokenPair{}, &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to create session"}
	}

	return pair, nil
}

func mcpRotateSession(ctx context.Context, deps *server.Deps, grant mcpTokenGrant, grantID, presentedTokenID uuid.UUID) (mcpTokenPair, error) {
	refreshTokenID := uuid.New()
	now := time.Now()
	atExpiry := now.Add(mcpTokenExpiry)
	rtExpiry := now.Add(mcpRefreshTokenExpiry)

	pair, signErr := mcpSignTokenPair(deps, grantID, refreshTokenID, grant.UserID, atExpiry, rtExpiry)
	if signErr != nil {
		return mcpTokenPair{}, signErr
	}

	checkedAt := now
	if grant.ProviderTokenCheckedAt != nil {
		checkedAt = *grant.ProviderTokenCheckedAt
	}
	stmt := sqlf.PostgreSQL.
		Update("mcp_auth_sessions").
		Set("rt_jti", refreshTokenID).
		Set("prev_rt_jti", presentedTokenID).
		Set("rt_rotated_at", now).
		Set("provider_token_checked_at", checkedAt).
		Set("at_expiry_at", atExpiry).
		Set("rt_expiry_at", rtExpiry).
		Where("id = ?", grantID).
		Where("rt_jti = ?", presentedTokenID)
	defer stmt.Close()

	tag, updErr := deps.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if updErr != nil {
		fmt.Printf("mcp: failed to rotate refresh token: %v\n", updErr)
		return mcpTokenPair{}, &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to replace refresh_token"}
	}
	if tag.RowsAffected() == 0 {
		session, lookupErr := mcpLoadSession(ctx, deps, grantID)
		if lookupErr != nil {
			return mcpTokenPair{}, lookupErr
		}
		// This request saw the presented token as current when it loaded the
		// session, so a rotation away from that token is a concurrent refresh.
		// The reuse window is not checked because the provider recheck can
		// hold this request for longer than the window.
		if session.PrevRefreshTokenID != nil && *session.PrevRefreshTokenID == presentedTokenID {
			return mcpSignTokenPair(deps, session.ID, session.RefreshTokenID, session.UserID, session.AccessExpiresAt, session.RefreshExpiresAt)
		}
		return mcpTokenPair{}, mcpEndReusedSession(ctx, deps, grantID)
	}

	return pair, nil
}

func mcpRecentlyReplaced(session mcpSession, tokenID uuid.UUID) bool {
	if session.PrevRefreshTokenID == nil || session.RotatedAt == nil {
		return false
	}
	return *session.PrevRefreshTokenID == tokenID && time.Since(*session.RotatedAt) <= mcpRefreshReuseWindow
}

func mcpLoadSession(ctx context.Context, deps *server.Deps, grantID uuid.UUID) (mcpSession, error) {
	var session mcpSession
	lookup := sqlf.PostgreSQL.
		From("mcp_auth_sessions").
		Select("id").
		Select("user_id").
		Select("client_id").
		Select("provider").
		Select("provider_token").
		Select("provider_token_checked_at").
		Select("rt_jti").
		Select("prev_rt_jti").
		Select("rt_rotated_at").
		Select("at_expiry_at").
		Select("rt_expiry_at").
		Where("id = ?", grantID)
	defer lookup.Close()

	dbErr := deps.PgPool.QueryRow(ctx, lookup.String(), lookup.Args()...).
		Scan(&session.ID, &session.UserID, &session.ClientID, &session.Provider, &session.ProviderToken,
			&session.ProviderTokenCheckedAt, &session.RefreshTokenID, &session.PrevRefreshTokenID, &session.RotatedAt,
			&session.AccessExpiresAt, &session.RefreshExpiresAt)
	if errors.Is(dbErr, pgx.ErrNoRows) {
		return mcpSession{}, mcpInvalidGrant("invalid or expired refresh_token")
	}
	if dbErr != nil {
		fmt.Printf("mcp: failed to look up session: %v\n", dbErr)
		return mcpSession{}, &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to look up refresh_token"}
	}
	return session, nil
}

func mcpEndReusedSession(ctx context.Context, deps *server.Deps, grantID uuid.UUID) error {
	fmt.Printf("mcp: refresh token reused on session %s, ending it\n", grantID)
	if endErr := mcpEndSession(ctx, deps, grantID); endErr != nil {
		fmt.Printf("mcp: failed to end reused session: %v\n", endErr)
	}
	return mcpInvalidGrant("invalid or expired refresh_token")
}

func mcpCheckSigningSecrets(deps *server.Deps) error {
	if len(deps.Config.AccessTokenSecret) == 0 || len(deps.Config.RefreshTokenSecret) == 0 {
		fmt.Println("mcp: SESSION_ACCESS_SECRET or SESSION_REFRESH_SECRET is not set, refusing to handle MCP tokens")
		return &mcpHTTPError{Status: http.StatusServiceUnavailable, Message: "MCP sign-in is not configured on this server"}
	}
	return nil
}

func mcpParseSignedToken(rawToken string, secret []byte) (jwt.MapClaims, error) {
	if rawToken == "" {
		return nil, &mcpHTTPError{Status: http.StatusUnauthorized, Message: "empty bearer token"}
	}
	if len(secret) == 0 {
		return nil, &mcpHTTPError{Status: http.StatusUnauthorized, Message: "invalid or malformed token"}
	}
	parsed, err := jwt.Parse(rawToken, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return secret, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, &mcpHTTPError{Status: http.StatusUnauthorized, Message: "token has expired"}
		}
		return nil, &mcpHTTPError{Status: http.StatusUnauthorized, Message: "invalid or malformed token"}
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return nil, &mcpHTTPError{Status: http.StatusUnauthorized, Message: "invalid or malformed token"}
	}
	if aud, _ := claims["aud"].(string); aud != authsession.AudienceMCP {
		return nil, &mcpHTTPError{Status: http.StatusUnauthorized, Message: "token was not issued for the MCP endpoint"}
	}
	return claims, nil
}

func mcpClaimUUID(claims jwt.MapClaims, key string) (uuid.UUID, error) {
	raw, _ := claims[key].(string)
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, &mcpHTTPError{Status: http.StatusUnauthorized, Message: "invalid or malformed token"}
	}
	return id, nil
}

// mcpRefresh exchanges a refresh token for a new pair on the same session.
// The presented refresh token stops working once the reuse window passes,
// and the access token issued with it keeps working until its own expiry.
func mcpRefresh(ctx context.Context, deps *server.Deps, refreshToken, clientID, resource string) (mcpTokenPair, error) {
	if resErr := mcpValidateResource(deps.Config.AgentOrigin, resource); resErr != nil {
		return mcpTokenPair{}, resErr
	}

	claims, parseErr := mcpParseSignedToken(refreshToken, deps.Config.RefreshTokenSecret)
	if parseErr != nil {
		return mcpTokenPair{}, mcpInvalidGrant("invalid or expired refresh_token")
	}
	tokenID, tokenErr := mcpClaimUUID(claims, "jti")
	if tokenErr != nil {
		return mcpTokenPair{}, mcpInvalidGrant("invalid or expired refresh_token")
	}
	grantID, grantErr := mcpClaimUUID(claims, "sid")
	if grantErr != nil {
		return mcpTokenPair{}, mcpInvalidGrant("invalid or expired refresh_token")
	}

	session, lookupErr := mcpLoadSession(ctx, deps, grantID)
	if lookupErr != nil {
		return mcpTokenPair{}, lookupErr
	}

	isCurrent := session.RefreshTokenID == tokenID
	if !isCurrent && !mcpRecentlyReplaced(session, tokenID) {
		return mcpTokenPair{}, mcpEndReusedSession(ctx, deps, grantID)
	}
	if clientID != "" && clientID != session.ClientID {
		return mcpTokenPair{}, mcpInvalidGrant("client_id mismatch")
	}
	if time.Now().After(session.RefreshExpiresAt) {
		return mcpTokenPair{}, mcpInvalidGrant("refresh_token has expired")
	}
	if !isCurrent {
		return mcpSignTokenPair(deps, session.ID, session.RefreshTokenID, session.UserID, session.AccessExpiresAt, session.RefreshExpiresAt)
	}

	// Access tokens are never looked up, so a refresh is the only moment a
	// session can be ended after the user revokes access at the provider.
	grant, checkErr := mcpRecheckProvider(ctx, deps, session)
	if checkErr != nil {
		return mcpTokenPair{}, checkErr
	}

	return mcpRotateSession(ctx, deps, grant, grantID, tokenID)
}

// mcpEndSession stops the refresh token. Access tokens already created run out
// on their own.
func mcpEndSession(ctx context.Context, deps *server.Deps, sessionID uuid.UUID) error {
	stmt := sqlf.PostgreSQL.
		DeleteFrom("mcp_auth_sessions").
		Where("id = ?", sessionID)
	defer stmt.Close()

	if _, err := deps.PgPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return fmt.Errorf("end session: %w", err)
	}
	return nil
}

// mcpToken exchanges an MCP auth code for a token pair.
func mcpToken(ctx context.Context, deps *server.Deps, code, redirectURI, clientID, codeVerifier, resource string) (mcpTokenPair, error) {
	pgPool := deps.PgPool

	if resErr := mcpValidateResource(deps.Config.AgentOrigin, resource); resErr != nil {
		return mcpTokenPair{}, resErr
	}

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

	lookup := sqlf.PostgreSQL.
		From("mcp_auth_codes").
		Select("user_id").
		Select("client_id").
		Select("redirect_uri").
		Select("code_challenge").
		Select("provider").
		Select("provider_token").
		Select("expires_at").
		Select("used").
		Where("code = ?", code)
	defer lookup.Close()

	dbErr := pgPool.QueryRow(ctx, lookup.String(), lookup.Args()...).
		Scan(&dbUserID, &dbClientID, &dbRedirectURI, &dbCodeChallenge, &dbProvider, &dbProviderToken, &dbExpiresAt, &dbUsed)
	if errors.Is(dbErr, pgx.ErrNoRows) {
		return mcpTokenPair{}, mcpInvalidGrant("invalid or unknown code")
	}
	if dbErr != nil {
		fmt.Printf("mcp: failed to look up auth code: %v\n", dbErr)
		return mcpTokenPair{}, &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to look up code"}
	}

	if dbUsed {
		return mcpTokenPair{}, mcpInvalidGrant("code already used")
	}
	if time.Now().After(dbExpiresAt) {
		return mcpTokenPair{}, mcpInvalidGrant("code has expired")
	}
	if clientID != "" && clientID != dbClientID {
		return mcpTokenPair{}, mcpInvalidGrant("client_id mismatch")
	}
	if redirectURI != "" && redirectURI != dbRedirectURI {
		return mcpTokenPair{}, mcpInvalidGrant("redirect_uri mismatch")
	}
	if dbCodeChallenge != "" {
		if codeVerifier == "" {
			return mcpTokenPair{}, mcpInvalidGrant("code_verifier is required")
		}
		if !mcpVerifyPKCES256(codeVerifier, dbCodeChallenge) {
			return mcpTokenPair{}, mcpInvalidGrant("code_verifier does not match code_challenge")
		}
	}

	tx, txErr := pgPool.Begin(ctx)
	if txErr != nil {
		return mcpTokenPair{}, &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to invalidate code"}
	}
	defer tx.Rollback(ctx)

	// The read of used above can be stale, so the update decides. Only one of
	// two exchanges on the same code claims it.
	markUsed := sqlf.PostgreSQL.
		Update("mcp_auth_codes").
		Set("used", true).
		Where("code = ?", code).
		Where("not used")
	defer markUsed.Close()

	tag, updErr := tx.Exec(ctx, markUsed.String(), markUsed.Args()...)
	if updErr != nil {
		return mcpTokenPair{}, &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to invalidate code"}
	}
	if tag.RowsAffected() == 0 {
		return mcpTokenPair{}, mcpInvalidGrant("code already used")
	}

	pair, issueErr := mcpStartSession(ctx, deps, mcpTokenGrant{
		UserID:        dbUserID,
		ClientID:      dbClientID,
		Provider:      dbProvider,
		ProviderToken: dbProviderToken,
	}, &tx)
	if issueErr != nil {
		return mcpTokenPair{}, issueErr
	}
	if commitErr := tx.Commit(ctx); commitErr != nil {
		return mcpTokenPair{}, &mcpHTTPError{Status: http.StatusInternalServerError, Message: "failed to create access token"}
	}
	return pair, nil
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
func mcpFindOrCreateUser(ctx context.Context, deps *server.Deps, name, email string) (mcpUserInfo, error) {
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

		if err := measure.CreateNotifPref(deps.PgPool, uuid.MustParse(*msrUser.ID)); err != nil {
			fmt.Println("mcp: failed to create notif prefs:", err)
		}

		if _, err := measure.CreatePersonalTeam(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), msrUser); err != nil {
			return mcpUserInfo{}, fmt.Errorf("%s: %w", msg, err)
		}

		if err := measure.AddNewUserToInvitedTeams(ctx, deps.PgPool, *msrUser.ID, email); err != nil {
			fmt.Println("mcp: failed to add user to invited teams:", err)
		}
	} else {
		if err := msrUser.TouchLastSignInAt(ctx, deps.PgPool); err != nil {
			fmt.Println("mcp: failed to touch last_sign_in_at:", err)
		}

		if _, err := measure.EnsureDefaultTeam(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), msrUser); err != nil {
			return mcpUserInfo{}, fmt.Errorf("%s: %w", msg, err)
		}
	}

	return mcpUserInfo{ID: uuid.MustParse(*msrUser.ID)}, nil
}

// --------------------------------------------------------------------------
// Token helpers
// --------------------------------------------------------------------------

// mcpValidateToken checks the signature and expiry alone, so an MCP request
// costs no database read and an ended session goes unnoticed until a refresh.
func mcpValidateToken(deps *server.Deps, rawToken string) (uuid.UUID, error) {
	claims, err := mcpParseSignedToken(rawToken, deps.Config.AccessTokenSecret)
	if err != nil {
		return uuid.Nil, err
	}
	return mcpClaimUUID(claims, "sub")
}

// mcpRecheckProvider ends the session when the provider says the token is dead.
func mcpRecheckProvider(ctx context.Context, deps *server.Deps, session mcpSession) (mcpTokenGrant, error) {
	grant := mcpTokenGrant{
		UserID:                 session.UserID,
		ClientID:               session.ClientID,
		Provider:               session.Provider,
		ProviderToken:          session.ProviderToken,
		ProviderTokenCheckedAt: session.ProviderTokenCheckedAt,
	}
	if session.ProviderToken == nil || *session.ProviderToken == "" {
		return grant, nil
	}
	if session.ProviderTokenCheckedAt != nil && time.Since(*session.ProviderTokenCheckedAt) <= mcpProviderTokenCheckInterval {
		return grant, nil
	}

	provider := ""
	if session.Provider != nil {
		provider = *session.Provider
	}
	if valErr := mcpValidateProviderTokenFn(provider, *session.ProviderToken, deps.Config.OAuthGoogleKey, deps.Config.OAuthGoogleSecret); valErr != nil {
		if !errors.Is(valErr, authsession.ErrProviderAccessRevoked) {
			fmt.Printf("mcp: could not check the provider token for session %s: %v\n", session.ID, valErr)
			return grant, nil
		}
		fmt.Printf("mcp: ending session %s, the provider rejected its token\n", session.ID)
		if endErr := mcpEndSession(ctx, deps, session.ID); endErr != nil {
			fmt.Println("mcp: failed to end session:", endErr)
		}
		return mcpTokenGrant{}, mcpInvalidGrant("access to Measure was withdrawn at the identity provider")
	}

	now := time.Now()
	grant.ProviderTokenCheckedAt = &now
	return grant, nil
}

// mcpParseBearerToken extracts the raw token from an "Authorization: Bearer <token>" header.
func mcpParseBearerToken(authHeader string) (string, error) {
	if authHeader == "" {
		return "", &mcpHTTPError{Status: http.StatusUnauthorized, Message: "missing Authorization header"}
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", &mcpHTTPError{Status: http.StatusUnauthorized, Message: "invalid Authorization header format"}
	}
	token := strings.TrimSpace(parts[1])
	if token == "" {
		return "", &mcpHTTPError{Status: http.StatusUnauthorized, Message: "empty bearer token"}
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

	clientID, err := mcpRegisterClient(ctx, deps, req.ClientName, req.RedirectURIs)
	if err != nil {
		mcpAbortWithError(c, err)
		return
	}

	fmt.Printf("mcp: registered client %q (%s)\n", req.ClientName, clientID)
	c.JSON(http.StatusCreated, gin.H{
		"client_id":                  clientID,
		"client_name":                req.ClientName,
		"redirect_uris":              req.RedirectURIs,
		"token_endpoint_auth_method": "none",
	})
}

// MCPProtectedResourceMetadata handles GET /.well-known/oauth-protected-resource.
func (h Handlers) MCPProtectedResourceMetadata(c *gin.Context) {
	deps := h.Deps
	c.JSON(http.StatusOK, mcpProtectedResourceMetadata(deps.Config.AgentOrigin, deps.Config.AgentOrigin))
}

// MCPEndpointProtectedResourceMetadata handles GET /.well-known/oauth-protected-resource/mcp.
func (h Handlers) MCPEndpointProtectedResourceMetadata(c *gin.Context) {
	deps := h.Deps
	c.JSON(http.StatusOK, mcpProtectedResourceMetadata(deps.Config.AgentOrigin, mcpResourceURL(deps.Config.AgentOrigin)))
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
	resource := c.Query("resource")
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

	if mcpIsClientMetadataURL(clientID) {
		if err := mcpValidateClientID(clientID); err != nil {
			mcpAbortWithError(c, err)
			return
		}
	}
	if codeChallenge == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "code_challenge is required"})
		return
	}
	if err := mcpValidateResource(deps.Config.AgentOrigin, resource); err != nil {
		mcpAbortWithError(c, err)
		return
	}

	// The login page names the client alongside the host the user will be sent
	// back to, so an unregistered redirect URI has to be rejected before that
	// page renders.
	registeredURIs, err := mcpClientRedirectURIs(ctx, deps, clientID)
	if err != nil {
		mcpAbortWithError(c, err)
		return
	}
	if !mcpRedirectURIAllowed(redirectURI, registeredURIs) {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "redirect_uri not registered for this client"})
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

	providerURL, err := mcpAuthorize(ctx, deps, provider, clientID, redirectURI, mcpState, codeChallenge)
	if err != nil {
		mcpAbortAuthorize(c, deps.Config.AgentOrigin, redirectURI, mcpState, err)
		return
	}

	fmt.Printf("mcp: authorize redirect issued (client=%s provider=%s)\n", clientID, provider)
	c.Redirect(http.StatusFound, providerURL)
}

// mcpAbortAuthorize reports an authorization failure by sending the browser to
// the client's redirect URI with the error in its query, which is where the MCP
// client waits for the authorization code. Only call this once redirectURI has
// passed mcpRedirectURIAllowed, since an address that has not been checked may
// not belong to the client.
func mcpAbortAuthorize(c *gin.Context, apiOrigin, redirectURI, state string, err error) {
	code, desc := "server_error", "authorization failed"
	var herr *mcpHTTPError
	if errors.As(err, &herr) {
		desc = herr.Message
		switch {
		case herr.OAuthError != "":
			code = herr.OAuthError
		case herr.Status < http.StatusInternalServerError:
			code = "invalid_request"
		}
	}

	params := url.Values{}
	params.Set("error", code)
	params.Set("error_description", desc)
	params.Set("iss", apiOrigin)
	if state != "" {
		params.Set("state", state)
	}
	target, buildErr := mcpAppendRedirectParams(redirectURI, params)
	if buildErr != nil {
		mcpAbortWithError(c, err)
		return
	}
	c.Redirect(http.StatusFound, target)
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
		mcpAbortWithError(c, err)
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
	refreshToken := c.PostForm("refresh_token")
	resource := c.PostForm("resource")

	// Also support JSON body.
	if grantType == "" {
		var body struct {
			GrantType    string `json:"grant_type"`
			Code         string `json:"code"`
			RedirectURI  string `json:"redirect_uri"`
			ClientID     string `json:"client_id"`
			CodeVerifier string `json:"code_verifier"`
			RefreshToken string `json:"refresh_token"`
			Resource     string `json:"resource"`
		}
		if err := c.ShouldBindJSON(&body); err == nil {
			grantType = body.GrantType
			code = body.Code
			redirectURI = body.RedirectURI
			clientID = body.ClientID
			codeVerifier = body.CodeVerifier
			refreshToken = body.RefreshToken
			resource = body.Resource
		}
	}

	// Token responses carry credentials, so RFC 6749 forbids caching them.
	c.Header("Cache-Control", "no-store")

	var (
		pair mcpTokenPair
		err  error
	)
	switch grantType {
	case "":
		err = &mcpHTTPError{Status: http.StatusBadRequest, Message: "grant_type is required", OAuthError: "invalid_request"}
	case "authorization_code":
		if code == "" {
			err = &mcpHTTPError{Status: http.StatusBadRequest, Message: "code is required", OAuthError: "invalid_request"}
			break
		}
		pair, err = mcpToken(ctx, deps, code, redirectURI, clientID, codeVerifier, resource)
	case "refresh_token":
		if refreshToken == "" {
			err = &mcpHTTPError{Status: http.StatusBadRequest, Message: "refresh_token is required", OAuthError: "invalid_request"}
			break
		}
		pair, err = mcpRefresh(ctx, deps, refreshToken, clientID, resource)
	default:
		err = &mcpHTTPError{Status: http.StatusBadRequest, Message: "grant_type " + grantType + " is not supported", OAuthError: "unsupported_grant_type"}
	}
	if err != nil {
		mcpAbortWithError(c, err)
		return
	}

	fmt.Printf("mcp: access token issued (client=%s grant=%s)\n", clientID, grantType)
	c.JSON(http.StatusOK, gin.H{
		"access_token":  pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"token_type":    "Bearer",
		"expires_in":    int(mcpTokenExpiry.Seconds()),
	})
}

// mcpBearerChallenge builds the WWW-Authenticate value clients use to discover
// the authorization server. RFC 6750 uses the error code only when the request
// carried a token.
func mcpBearerChallenge(apiOrigin string, tokenPresented bool) string {
	challenge := "Bearer "
	if tokenPresented {
		challenge += `error="invalid_token", `
	}
	return challenge + `resource_metadata="` + mcpResourceMetadataURL(apiOrigin) + `"`
}

// ValidateMCPToken validates an MCP bearer token from the Authorization header.
// On success it sets "userId" in the Gin context and injects it into the request
// context so that mcp-go tool handlers can read it.
func (h Handlers) ValidateMCPToken() gin.HandlerFunc {
	deps := h.Deps
	return func(c *gin.Context) {
		rawToken, err := mcpParseBearerToken(c.GetHeader("Authorization"))
		if err != nil {
			c.Header("WWW-Authenticate", mcpBearerChallenge(deps.Config.AgentOrigin, false))
			mcpAbortWithError(c, err)
			return
		}

		userID, err := mcpValidateToken(deps, rawToken)
		if err != nil {
			c.Header("WWW-Authenticate", mcpBearerChallenge(deps.Config.AgentOrigin, true))
			mcpAbortWithError(c, err)
			return
		}

		userIDStr := userID.String()
		c.Set("userId", userIDStr)

		// Inject user ID into the request context for the tool handlers.
		newCtx := agent.WithUserID(c.Request.Context(), userIDStr)
		c.Request = c.Request.WithContext(newCtx)

		c.Next()
	}
}
