package authsession

import (
	"backend/api/server"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

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
		InsertInto("public.auth_states").
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
		From("public.auth_states").
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
		DeleteFrom("public.auth_states").
		Where("state = ? and oauth_provider = ?", state, provider)

	defer stmt.Close()

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// ExchangeCodeForToken exchanges code for a GitHub access token.
func ExchangeCodeForToken(code string) (githubToken GitHubToken, err error) {
	endpoint := "https://github.com/login/oauth/access_token"

	data := url.Values{}
	data.Set("client_id", server.Server.Config.OAuthGitHubKey)
	data.Set("client_secret", server.Server.Config.OAuthGitHubSecret)
	data.Set("code", code)
	data.Set("redirect_uri", fmt.Sprintf("%s/auth/callback/github", server.Server.Config.SiteOrigin))

	payload := strings.NewReader(data.Encode())

	req, err := http.NewRequest("POST", endpoint, payload)
	if err != nil {
		return
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return
	}

	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}

	if err = json.Unmarshal(body, &githubToken); err != nil {
		return
	}

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
