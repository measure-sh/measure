package handlers

import (
	"fmt"
	"net/http"

	"backend/libs/event"
	"backend/libs/journeymap"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetAppJourneyMap returns the screens of an app, the transitions between
// them and the wireframe of each screen, built from every session that
// captured a layout snapshot.
func (h Handlers) GetAppJourneyMap(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	userId := c.GetString("userId")

	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := measure.App{ID: &appId}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID

	msg := `failed to build app's journey map`

	events, err := app.GetJourneyMapEvents(ctx, deps.RchPool)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	reader, err := event.NewAttachmentReader(ctx, event.ReaderConfig{
		IsCloud:                    deps.Config.IsCloud(),
		AWSEndpoint:                deps.Config.AWSEndpoint,
		AttachmentsBucket:          deps.Config.AttachmentsBucket,
		AttachmentsBucketRegion:    deps.Config.AttachmentsBucketRegion,
		AttachmentsAccessKey:       deps.Config.AttachmentsAccessKey,
		AttachmentsSecretAccessKey: deps.Config.AttachmentsSecretAccessKey,
	})
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	defer reader.Close()

	m, err := journeymap.Build(ctx, events, reader.Read)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, m)
}
