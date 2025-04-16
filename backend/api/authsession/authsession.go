package authsession

import (
	"backend/api/server"
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

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

// createAccessToken creates a new access token.
func createAccessToken(userId, ownTeamId uuid.UUID, secret []byte, expiry time.Time) (token string, err error) {
	claims := jwt.MapClaims{
		"iat": time.Now().Unix(),
		"sub": userId.String(),
		"exp": expiry.Unix(),
		"iss": "measure",
		"oti": ownTeamId.String(),
	}

	tokenCursor := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token, err = tokenCursor.SignedString(secret)
	if err != nil {
		return
	}

	return
}

// createRefreshToken creates a new refresh token.
func createRefreshToken(secret []byte, jti uuid.UUID, expiry time.Time) (token string, err error) {
	claims := jwt.MapClaims{
		"jti": jti.String(),
		"exp": expiry.Unix(),
	}

	tokenCursor := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token, err = tokenCursor.SignedString(secret)
	if err != nil {
		return
	}

	return
}

// NewAuthSession creates a new authentication session object.
func NewAuthSession(userId, ownTeamId uuid.UUID, provider string, meta json.RawMessage) (authSession AuthSession, err error) {
	authSession.ID = uuid.New()
	authSession.UserID = userId
	authSession.OAuthProvider = provider

	if !json.Valid(meta) {
		err = errors.New("user meta data is not valid json")
		return
	}

	authSession.UserMeta = meta

	now := time.Now()
	atSecret := server.Server.Config.AccessTokenSecret
	atExpiryAt := now.Add(accessTokenExpiryDuration)

	accessToken, err := createAccessToken(userId, ownTeamId, atSecret, atExpiryAt)
	if err != nil {
		return
	}

	rtSecret := server.Server.Config.RefreshTokenSecret
	rtExpiryAt := now.Add(refreshTokenExpiryDuration)
	refreshToken, err := createRefreshToken(rtSecret, authSession.ID, rtExpiryAt)
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
func RemoveSession(ctx context.Context, jti uuid.UUID, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		DeleteFrom("public.auth_sessions").
		Where("id = ?", jti)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// GetAuthSession finds an authentication session from its id.
func GetAuthSession(ctx context.Context, id uuid.UUID) (authSession AuthSession, err error) {
	stmt := sqlf.PostgreSQL.
		From("public.auth_sessions").
		Select("id").
		Select("user_id").
		Select("oauth_provider").
		Select("user_metadata").
		Select("at_expiry_at").
		Select("rt_expiry_at").
		Where("id = ?", id)

	defer stmt.Close()

	err = server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&authSession.ID, &authSession.UserID, &authSession.OAuthProvider, &authSession.UserMeta, &authSession.AccessTokenExpiryAt, &authSession.RefreshTokenExpiryAt)

	return
}

// RemoveExpiredSessions removes expired auth sessions.
func RemoveExpiredSessions(ctx context.Context) (err error) {
	stmt := sqlf.PostgreSQL.
		DeleteFrom("public.auth_sessions").
		Where("rt_expiry_at < ?", time.Now())

	defer stmt.Close()

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	return
}

// Save saves the authentication session to database.
func (au *AuthSession) Save(ctx context.Context, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		InsertInto("public.auth_sessions").
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

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}
