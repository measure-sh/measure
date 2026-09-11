package handlers

import (
	"fmt"
	"net/http"

	"backend/libs/filter"
	"backend/libs/logcomment"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
)

func (h Handlers) GetHealthOverviewPlotInstances(c *gin.Context) {
	deps := h.Deps
	app, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:          filter.AppHealthEntity,
		appScope:        *measure.ScopeAppRead,
		logRoot:         logcomment.Health,
		logName:         "plots_instances",
		requireTimezone: true,
	})
	if !ok {
		return
	}

	sessions, crashes, anrs, err := app.GetHealthPlotInstances(ctx, deps.RchPool, &flt)
	if err != nil {
		msg := `failed to query data for health overview plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type series struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	build := func(id string, points []measure.HealthInstance) series {
		s := series{ID: id, Data: []gin.H{}}
		for i := range points {
			s.Data = append(s.Data, gin.H{
				"datetime":  points[i].DateTime,
				"instances": points[i].Instances,
			})
		}
		return s
	}

	c.JSON(http.StatusOK, []series{
		build("sessions", sessions),
		build("crashes", crashes),
		build("anrs", anrs),
	})
}
