package authsession

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

// refreshReuseWindow is how long the refresh token replaced by a rotation
// still returns the current pair, so the dashboard sending several refreshes
// with the same cookie at once doesn't end its own session.
const refreshReuseWindow = 10 * time.Second

// ErrRefreshTokenReused is returned when a refresh is attempted with a
// refresh token the session no longer accepts, after the session is removed.
var ErrRefreshTokenReused = errors.New("refresh token reused")

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
	RefreshTokenID       uuid.UUID
	PrevRefreshTokenID   *uuid.UUID
	RotatedAt            *time.Time
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
	authSession.RefreshTokenID = uuid.New()
	authSession.AccessTokenExpiryAt = now.Add(accessTokenExpiryDuration)
	authSession.RefreshTokenExpiryAt = now.Add(refreshTokenExpiryDuration)

	err = authSession.sign(accessSecret, refreshSecret)

	return
}

func (au *AuthSession) sign(accessSecret, refreshSecret []byte) (err error) {
	au.AccessToken, err = CreateAccessToken(accessSecret, au.ID, au.ID, au.UserID, au.AccessTokenExpiryAt, "")
	if err != nil {
		return
	}

	au.RefreshToken, err = CreateRefreshToken(refreshSecret, au.RefreshTokenID, au.ID, au.RefreshTokenExpiryAt, "")

	return
}

func (au *AuthSession) recentlyReplaced(tokenID uuid.UUID) bool {
	if au.PrevRefreshTokenID == nil || au.RotatedAt == nil {
		return false
	}
	return *au.PrevRefreshTokenID == tokenID && time.Since(*au.RotatedAt) <= refreshReuseWindow
}

// RefreshAuthSession exchanges a session's refresh token for a new pair.
func RefreshAuthSession(ctx context.Context, pg *pgxpool.Pool, accessSecret, refreshSecret []byte, sessionID, tokenID uuid.UUID) (authSession AuthSession, err error) {
	authSession, err = GetAuthSession(ctx, pg, sessionID)
	if err != nil {
		return
	}

	isCurrent := authSession.RefreshTokenID == tokenID
	if !isCurrent && !authSession.recentlyReplaced(tokenID) {
		return AuthSession{}, removeReusedSession(ctx, pg, sessionID)
	}
	if !isCurrent {
		err = authSession.sign(accessSecret, refreshSecret)
		return
	}

	now := time.Now()
	authSession.RefreshTokenID = uuid.New()
	authSession.AccessTokenExpiryAt = now.Add(accessTokenExpiryDuration)
	authSession.RefreshTokenExpiryAt = now.Add(refreshTokenExpiryDuration)
	if err = authSession.sign(accessSecret, refreshSecret); err != nil {
		return AuthSession{}, err
	}

	stmt := sqlf.PostgreSQL.
		Update("auth_sessions").
		Set("rt_jti", authSession.RefreshTokenID).
		Set("prev_rt_jti", tokenID).
		Set("rt_rotated_at", now).
		Set("at_expiry_at", authSession.AccessTokenExpiryAt).
		Set("rt_expiry_at", authSession.RefreshTokenExpiryAt).
		Where("id = ?", sessionID).
		Where("rt_jti = ?", tokenID)

	defer stmt.Close()

	tag, err := pg.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return AuthSession{}, err
	}
	if tag.RowsAffected() == 1 {
		return authSession, nil
	}

	// This request saw the presented token as current when it loaded the
	// session, so the rotation away from that token was made by a concurrent
	// refresh with the same token.
	authSession, err = GetAuthSession(ctx, pg, sessionID)
	if err != nil {
		return AuthSession{}, err
	}
	if authSession.PrevRefreshTokenID == nil || *authSession.PrevRefreshTokenID != tokenID {
		return AuthSession{}, removeReusedSession(ctx, pg, sessionID)
	}
	err = authSession.sign(accessSecret, refreshSecret)

	return
}

func removeReusedSession(ctx context.Context, pg *pgxpool.Pool, sessionID uuid.UUID) error {
	if err := RemoveSession(ctx, pg, sessionID, nil); err != nil {
		return fmt.Errorf("remove reused session: %w", err)
	}
	return ErrRefreshTokenReused
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
		Select("rt_jti").
		Select("prev_rt_jti").
		Select("rt_rotated_at").
		Where("id = ?", id)

	defer stmt.Close()

	err = pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&authSession.ID, &authSession.UserID, &authSession.OAuthProvider, &authSession.UserMeta, &authSession.AccessTokenExpiryAt, &authSession.RefreshTokenExpiryAt, &authSession.RefreshTokenID, &authSession.PrevRefreshTokenID, &authSession.RotatedAt)

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
		Set("rt_expiry_at", au.RefreshTokenExpiryAt).
		Set("rt_jti", au.RefreshTokenID)

	defer stmt.Clone()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = pg.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}
