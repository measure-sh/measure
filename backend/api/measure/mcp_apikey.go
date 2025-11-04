package measure

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend/api/chrono"
	"backend/api/cipher"
	"backend/api/server"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

const McpKeyPrefix = "msrsh_mcp"

type McpKey struct {
	Id        uuid.UUID
	userId    uuid.UUID
	teamId    uuid.UUID
	name      string
	keyPrefix string
	keyValue  string
	checksum  string
	revoked   bool
	lastSeen  time.Time
	createdAt time.Time
}

func (a McpKey) MarshalJSON() ([]byte, error) {
	apiMap := make(map[string]any)

	apiMap["id"] = a.Id
	apiMap["key"] = a.String()
	apiMap["name"] = a.name
	apiMap["revoked"] = a.revoked
	apiMap["created_at"] = a.createdAt.Format(chrono.ISOFormatJS)
	if a.lastSeen.IsZero() {
		apiMap["last_seen"] = nil
	} else {
		apiMap["last_seen"] = a.lastSeen.Format(chrono.ISOFormatJS)
	}
	return json.Marshal(apiMap)
}

func (a *McpKey) String() string {
	return fmt.Sprintf("%s_%s_%s", a.keyPrefix, a.keyValue, a.checksum)
}

func newMcpKey(userId uuid.UUID, teamId uuid.UUID, name string) (*McpKey, error) {
	bytes := make([]byte, 32)
	_, err := rand.Read(bytes)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	byteString := hex.EncodeToString(bytes)

	checksum, err := cipher.ComputeChecksum([]byte(byteString))
	if err != nil {
		return nil, err
	}

	return &McpKey{
		userId:    userId,
		teamId:    teamId,
		name:      name,
		keyPrefix: McpKeyPrefix,
		keyValue:  byteString,
		checksum:  *checksum,
		revoked:   false,
		createdAt: time.Now(),
	}, nil
}

func fetchMcpKeys(ctx context.Context, userId uuid.UUID, teamId uuid.UUID) ([]*McpKey, error) {
	stmt := sqlf.PostgreSQL.Select("id, name, key_prefix, key_value, checksum, revoked, last_seen, created_at").
		From("mcp_keys").
		Where("user_id = ?", userId).
		Where("team_id = ?", teamId)
	defer stmt.Close()

	var mcpKeys []*McpKey
	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), userId, teamId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		var name string
		var keyPrefix string
		var keyValue string
		var checksum string
		var revoked bool
		var lastSeen *time.Time
		var createdAt time.Time

		if err := rows.Scan(&id, &name, &keyPrefix, &keyValue, &checksum, &revoked, &lastSeen, &createdAt); err != nil {
			return nil, err
		}

		mcpKey := &McpKey{
			Id:        id,
			userId:    userId,
			teamId:    teamId,
			name:      name,
			keyPrefix: keyPrefix,
			keyValue:  keyValue,
			checksum:  checksum,
			revoked:   revoked,
			createdAt: createdAt,
		}

		// Only set lastSeen if it's not null
		if lastSeen != nil {
			mcpKey.lastSeen = *lastSeen
		}

		mcpKeys = append(mcpKeys, mcpKey)
	}

	return mcpKeys, nil
}

func insertMcpKey(ctx context.Context, mcpKey *McpKey) error {
	stmt := sqlf.PostgreSQL.InsertInto("mcp_keys").
		Set("user_id", mcpKey.userId).
		Set("team_id", mcpKey.teamId).
		Set("name", mcpKey.name).
		Set("key_prefix", mcpKey.keyPrefix).
		Set("key_value", mcpKey.keyValue).
		Set("checksum", mcpKey.checksum).
		Set("revoked", false).
		Set("created_at", mcpKey.createdAt)

	// Only set last_seen if it's not zero
	if !mcpKey.lastSeen.IsZero() {
		stmt.Set("last_seen", mcpKey.lastSeen)
	}
	defer stmt.Close()

	args := []interface{}{mcpKey.userId, mcpKey.teamId, mcpKey.name, mcpKey.keyPrefix, mcpKey.keyValue, mcpKey.checksum, false, mcpKey.createdAt}
	if !mcpKey.lastSeen.IsZero() {
		args = append(args, mcpKey.lastSeen)
	}
	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), args...)
	return err
}

func revokeMcpKey(ctx context.Context, mcpKeyId uuid.UUID) error {
	stmt := sqlf.PostgreSQL.Update("mcp_keys").
		Set("revoked", true).
		Where("id = ?", mcpKeyId)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

func updateLastSeenForMcpKey(ctx context.Context, mcpKeyId uuid.UUID) error {
	stmt := sqlf.PostgreSQL.Update("mcp_keys").
		Set("last_seen", time.Now()).
		Where("id = ?", mcpKeyId)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

func GetMcpKeys(c *gin.Context) {
	userId, err := uuid.Parse(c.GetString("userId"))
	if err != nil {
		msg := `user id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	_, err = PerformAuthz(userId.String(), teamId.String(), *ScopeTeamRead)
	if err != nil {
		msg := `you are not authorized to access this team`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	mcpKeys, err := fetchMcpKeys(c.Request.Context(), userId, teamId)
	if err != nil {
		msg := "failed to fetch mcp keys"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, mcpKeys)
}

func GetUserAndTeamIdForMcpKey(c *gin.Context) {
	userId, err := uuid.Parse(c.GetString("userId"))
	if err != nil {
		msg := `user id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	teamId, err := uuid.Parse(c.GetString("teamId"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	_, err = PerformAuthz(userId.String(), teamId.String(), *ScopeTeamRead)
	if err != nil {
		msg := `you are not authorized to access this team`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id": userId,
		"team_id": teamId,
	})
}

func CreateMcpKey(c *gin.Context) {
	userId, err := uuid.Parse(c.GetString("userId"))
	if err != nil {
		msg := `user id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	_, err = PerformAuthz(userId.String(), teamId.String(), *ScopeTeamRead)
	if err != nil {
		msg := `you are not authorized to access this team`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		msg := "invalid request body"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	mcpKey, err := newMcpKey(userId, teamId, req.Name)
	if err != nil {
		msg := "failed to create MCP key"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	err = insertMcpKey(c.Request.Context(), mcpKey)
	if err != nil {
		msg := "failed to save MCP key"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusCreated, mcpKey)
}

func RevokeMcpKey(c *gin.Context) {
	userId, err := uuid.Parse(c.GetString("userId"))
	if err != nil {
		msg := `user id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	_, err = PerformAuthz(userId.String(), teamId.String(), *ScopeTeamRead)
	if err != nil {
		msg := `you are not authorized to access this team`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	mcpKeyId, err := uuid.Parse(c.Param("keyId"))
	if err != nil {
		msg := `invalid MCP key id`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	err = revokeMcpKey(c.Request.Context(), mcpKeyId)
	if err != nil {
		msg := "failed to revoke MCP key"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}

func DecodeMcpKey(c *gin.Context, key string) (*uuid.UUID, *uuid.UUID, error) {
	defaultErr := errors.New("invalid MCP key")

	if len(key) < 1 {
		return nil, nil, defaultErr
	}

	parts := strings.Split(key, "_")

	if len(parts) != 4 {
		return nil, nil, defaultErr
	}

	prefix := parts[0] + "_" + parts[1]
	value := parts[2]
	checksum := parts[3]

	if prefix != McpKeyPrefix {
		return nil, nil, defaultErr
	}

	computedChecksum, err := cipher.ComputeChecksum([]byte(value))
	if err != nil {
		return nil, nil, err
	}

	if checksum != *computedChecksum {
		return nil, nil, defaultErr
	}

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("user_id").
		Select("team_id").
		From("mcp_keys").
		Where("key_value = ? ", value).
		Where("checksum = ? ", checksum).
		Where("revoked = ?", false).
		Limit(1)
	defer stmt.Close()

	var id uuid.UUID
	var userId uuid.UUID
	var teamId uuid.UUID

	if err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), stmt.Args()...).Scan(&id, &userId, &teamId); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, defaultErr
		}
		return nil, nil, err
	}

	err = updateLastSeenForMcpKey(c, id)
	if err != nil {
		msg := "failed to update MCP key last seen value"
		fmt.Println(msg, err)
	}

	return &userId, &teamId, nil
}
