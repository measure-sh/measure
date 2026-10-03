package handlers

import (
	"fmt"
	"net/http"

	"backend/libs/filter"
	"backend/libs/logcomment"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
)

func (h Handlers) GetProfilesOverview(c *gin.Context) {
	deps := h.Deps
	app, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:   filter.ProfilesEntity,
		appScope: *measure.ScopeAppRead,
		logRoot:  logcomment.Profiles,
		logName:  "list",
	})
	if !ok {
		return
	}

	profiles, next, previous, err := app.GetProfilesWithFilter(ctx, deps.RchPool, &flt)
	if err != nil {
		msg := "failed to query profiles"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	for i := range profiles {
		for j := range profiles[i].Attachments {
			if err := profiles[i].Attachments[j].PreSignURL(ctx, presignConfig(deps)); err != nil {
				msg := "failed to generate URLs for attachment"
				fmt.Println(msg, err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"results": profiles,
		"meta":    gin.H{"next": next, "previous": previous},
	})
}
