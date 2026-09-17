package authsession

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// AudienceMCP marks a token as issued for the MCP endpoint. The dashboard and
// the agent sign with the same key, so this is used to differentiate between
// them.
const AudienceMCP = "mcp"

const accessTokenExpiryDuration = 30 * time.Minute
const refreshTokenExpiryDuration = 7 * 24 * time.Hour

// AuthSession represents authentication session.
type AuthSession struct {
	ID                   uuid.UUID
	UserID               uuid.UUID
	OAuthProvider        string
	UserMeta             json.RawMessage
	AccessToken          string
	RefreshToken         string
	AccessTokenExpiryAt  time.Time
	RefreshTokenExpiryAt time.Time
	CreatedAt            time.Time
}

func CreateAccessToken(secret []byte, jti, sessionID, userId uuid.UUID, expiry time.Time, audience string) (token string, err error) {
	claims := jwt.MapClaims{
		"iat": time.Now().Unix(),
		"sub": userId.String(),
		"jti": jti.String(),
		"sid": sessionID.String(),
		"exp": expiry.Unix(),
		"iss": "measure",
	}
	if audience != "" {
		claims["aud"] = audience
	}

	tokenCursor := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token, err = tokenCursor.SignedString(secret)
	if err != nil {
		return
	}

	return
}

func CreateRefreshToken(secret []byte, jti, sessionID uuid.UUID, expiry time.Time, audience string) (token string, err error) {
	claims := jwt.MapClaims{
		"jti": jti.String(),
		"sid": sessionID.String(),
		"exp": expiry.Unix(),
	}
	if audience != "" {
		claims["aud"] = audience
	}

	tokenCursor := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token, err = tokenCursor.SignedString(secret)
	if err != nil {
		return
	}

	return
}

// NewAuthSession creates a new authentication session object.
func NewAuthSession(accessSecret, refreshSecret []byte, userId uuid.UUID, provider string, meta json.RawMessage) (authSession AuthSession, err error) {
	authSession.ID = uuid.New()
	authSession.UserID = userId
	authSession.OAuthProvider = provider

	if !json.Valid(meta) {
		err = errors.New("user meta data is not valid json")
		return
	}

	authSession.UserMeta = meta

	now := time.Now()
	atSecret := accessSecret
	atExpiryAt := now.Add(accessTokenExpiryDuration)

	accessToken, err := CreateAccessToken(atSecret, authSession.ID, authSession.ID, userId, atExpiryAt, "")
	if err != nil {
		return
	}

	rtSecret := refreshSecret
	rtExpiryAt := now.Add(refreshTokenExpiryDuration)
	refreshToken, err := CreateRefreshToken(rtSecret, authSession.ID, authSession.ID, rtExpiryAt, "")
	if err != nil {
		return
	}

	authSession.AccessToken = accessToken
	authSession.RefreshToken = refreshToken
	authSession.AccessTokenExpiryAt = atExpiryAt
	authSession.RefreshTokenExpiryAt = rtExpiryAt

	return
}

// RemoveSession removes session from database.
func RemoveSession(ctx context.Context, pg *pgxpool.Pool, jti uuid.UUID, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		DeleteFrom("auth_sessions").
		Where("id = ?", jti)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = pg.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// GetAuthSession finds an authentication session from its id.
func GetAuthSession(ctx context.Context, pg *pgxpool.Pool, id uuid.UUID) (authSession AuthSession, err error) {
	stmt := sqlf.PostgreSQL.
		From("auth_sessions").
		Select("id").
		Select("user_id").
		Select("oauth_provider").
		Select("user_metadata").
		Select("at_expiry_at").
		Select("rt_expiry_at").
		Where("id = ?", id)

	defer stmt.Close()

	err = pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&authSession.ID, &authSession.UserID, &authSession.OAuthProvider, &authSession.UserMeta, &authSession.AccessTokenExpiryAt, &authSession.RefreshTokenExpiryAt)

	return
}

// Save saves the authentication session to database.
func (au *AuthSession) Save(ctx context.Context, pg *pgxpool.Pool, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		InsertInto("auth_sessions").
		Set("id", au.ID).
		Set("user_id", au.UserID).
		Set("oauth_provider", au.OAuthProvider).
		Set("user_metadata", au.UserMeta).
		Set("at_expiry_at", au.AccessTokenExpiryAt).
		Set("rt_expiry_at", au.RefreshTokenExpiryAt)

	defer stmt.Clone()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = pg.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}
