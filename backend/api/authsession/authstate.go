package authsession

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"backend/api/server"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// AuthState represents temporary state
// to store code and other details during
// authentication.
type AuthState struct {
	State         string
	Code          string
	OAuthProvider string `json:"oauth_provider"`
	AccessToken   string `json:"access_token"`
	RefreshToken  string `json:"refresh_token"`
}

// GitHubToken represents the GitHub token
// received from GitHub.
type GitHubToken struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
}

// GitHubUser represents the GitHub user.
type GitHubUser struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarUrl string `json:"avatar_url"`
	Company   string `json:"company"`
	Location  string `json:"location"`
}

// GoogleUser represents the Google user.
type GoogleUser struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Picture string `json:"picture"`
}

// Save saves the authentication state.
func (as AuthState) Save(ctx context.Context) (err error) {
	stmt := sqlf.PostgreSQL.
		InsertInto("auth_states").
		Set("id", uuid.New()).
		Set("state", as.State).
		Set("oauth_provider", as.OAuthProvider)

	defer stmt.Close()

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	return
}

// GetOAuthState find an oauth state by state.
func GetOAuthState(ctx context.Context, state, provider string) (authState AuthState, err error) {
	stmt := sqlf.PostgreSQL.
		From("auth_states").
		Select("state").
		Where("state = ? and oauth_provider = ?", state, provider).
		Limit(1)

	defer stmt.Close()

	if err = server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&authState.State); err != nil {
		return
	}

	return
}

// RemoveOAuthState removes an oauth state.
func RemoveOAuthState(ctx context.Context, state, provider string) (err error) {
	stmt := sqlf.PostgreSQL.
		DeleteFrom("auth_states").
		Where("state = ? and oauth_provider = ?", state, provider)

	defer stmt.Close()

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// ExchangeCodeForToken exchanges code for a GitHub access token.
func ExchangeCodeForToken(code string) (githubToken GitHubToken, err error) {
	token, err := ExchangeGitHubCodeForToken(code,
		fmt.Sprintf("%s/auth/callback/github", server.Server.Config.SiteOrigin),
		server.Server.Config.OAuthGitHubKey,
		server.Server.Config.OAuthGitHubSecret)
	if err != nil {
		return
	}
	githubToken.AccessToken = token
	return
}

// doGitHub makes GitHub API network requests.
func doGitHub(path, token string) (body []byte, err error) {
	endpoint := fmt.Sprintf("https://api.github.com%s", path)
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf(`failed to retrieve github oauth primary email, status code: %d`, resp.StatusCode)
		return
	}

	body, err = io.ReadAll(resp.Body)
	if err != nil {
		return
	}

	return
}

// GetGitHubUser fetches user info from GitHub.
func GetGitHubUser(token string) (user GitHubUser, err error) {
	body, err := doGitHub("/user", token)
	if err != nil {
		return
	}

	if err = json.Unmarshal(body, &user); err != nil {
		return
	}

	body, err = doGitHub("/user/emails", token)
	if err != nil {
		return
	}

	type ghEmail struct {
		Email   string `json:"email"`
		Primary bool   `json:"primary"`
	}

	var emails []ghEmail

	if err = json.Unmarshal(body, &emails); err != nil {
		return
	}

	for i := range emails {
		if emails[i].Primary {
			user.Email = emails[i].Email
			break
		}
	}

	return
}

// ExchangeGitHubCodeForToken exchanges a GitHub OAuth code for an access token.
func ExchangeGitHubCodeForToken(code, redirectURI, clientID, clientSecret string) (string, error) {
	endpoint := "https://github.com/login/oauth/access_token"
	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse GitHub token response: %w", err)
	}
	if result.Error != "" {
		return "", fmt.Errorf("GitHub OAuth error: %s", result.Error)
	}
	if result.AccessToken == "" {
		return "", fmt.Errorf("GitHub returned empty access token")
	}
	return result.AccessToken, nil
}

// ExchangeGoogleCode exchanges a Google authorization code for a refresh token
// and ID token using the server-side OAuth flow.
func ExchangeGoogleCode(code, redirectURI, clientID, clientSecret string) (refreshToken, idToken string, err error) {
	endpoint := "https://oauth2.googleapis.com/token"
	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)
	data.Set("grant_type", "authorization_code")

	req, reqErr := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if reqErr != nil {
		return "", "", reqErr
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, doErr := http.DefaultClient.Do(req)
	if doErr != nil {
		return "", "", doErr
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return "", "", readErr
	}

	var result struct {
		RefreshToken string `json:"refresh_token"`
		IDToken      string `json:"id_token"`
		Error        string `json:"error"`
		ErrorDesc    string `json:"error_description"`
	}
	if jsonErr := json.Unmarshal(body, &result); jsonErr != nil {
		return "", "", fmt.Errorf("failed to parse Google token response: %w", jsonErr)
	}
	if result.Error != "" {
		return "", "", fmt.Errorf("Google OAuth error: %s: %s", result.Error, result.ErrorDesc)
	}
	if result.IDToken == "" {
		return "", "", fmt.Errorf("Google returned empty id_token")
	}
	return result.RefreshToken, result.IDToken, nil
}

// GoogleIDTokenClaims holds the user info claims extracted from a Google ID token.
type GoogleIDTokenClaims struct {
	Name    string
	Email   string
	Picture string
}

// DecodeGoogleIDToken extracts user info claims from a Google ID token JWT.
// No signature verification is performed because the token was received
// directly from Google's token endpoint over HTTPS.
func DecodeGoogleIDToken(idToken string) (GoogleIDTokenClaims, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) < 2 {
		return GoogleIDTokenClaims{}, fmt.Errorf("invalid id_token: expected 3 parts, got %d", len(parts))
	}

	payload := parts[1]
	// Add padding if needed.
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}

	decoded, decErr := base64.URLEncoding.DecodeString(payload)
	if decErr != nil {
		return GoogleIDTokenClaims{}, fmt.Errorf("failed to decode id_token payload: %w", decErr)
	}

	var claims struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Picture string `json:"picture"`
	}
	if jsonErr := json.Unmarshal(decoded, &claims); jsonErr != nil {
		return GoogleIDTokenClaims{}, fmt.Errorf("failed to parse id_token claims: %w", jsonErr)
	}
	if claims.Email == "" {
		return GoogleIDTokenClaims{}, fmt.Errorf("id_token missing email claim")
	}
	return GoogleIDTokenClaims{
		Name:    claims.Name,
		Email:   claims.Email,
		Picture: claims.Picture,
	}, nil
}

// ValidateGoogleRefreshToken checks that a Google refresh token is still valid
// by attempting a token refresh. Returns nil if valid, error if revoked.
func ValidateGoogleRefreshToken(refreshToken, clientID, clientSecret string) error {
	endpoint := "https://oauth2.googleapis.com/token"
	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("refresh_token", refreshToken)
	data.Set("grant_type", "refresh_token")

	req, reqErr := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if reqErr != nil {
		return reqErr
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, doErr := http.DefaultClient.Do(req)
	if doErr != nil {
		return doErr
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Google refresh token validation failed: HTTP %d", resp.StatusCode)
	}
	return nil
}
