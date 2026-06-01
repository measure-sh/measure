package measure

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"backend/api/config"
	"backend/api/event"
	"backend/api/filter"
	"backend/api/server"
	"backend/libs/logcomment"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"golang.org/x/sync/errgroup"
)

// healthInstance is a single time-bucketed data point for one
// series (sessions, crashes or ANRs) of the health overview plot.
type healthInstance struct {
	DateTime  string
	Instances uint64
}

// GetHealthPlotInstances computes the sessions, crashes and ANRs time
// series for the health overview plot, bucketed by the filter's plot
// time group.
func (a App) GetHealthPlotInstances(ctx context.Context, af *filter.AppFilter) (sessions, crashes, anrs []healthInstance, err error) {
	if af.Timezone == "" {
		return nil, nil, nil, errors.New("missing timezone filter")
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, nil, nil, err
	}

	var healthGroup errgroup.Group

	// session counts
	healthGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment": lc.MustPut(logcomment.Root, logcomment.Health).String(),
		}
		sctx := logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "plots_instances")

		stmt := sqlf.From(config.AppMetricsTable).
			Select(groupExpr.BucketExpr+" as datetime_bucket", af.Timezone).
			Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
			Select("uniqMerge(unique_sessions) as instances").
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("timestamp >= ? and timestamp <= ?", af.From, af.To)
		defer stmt.Close()

		if af.HasVersions() {
			selectedVersions, errV := af.VersionPairs()
			if errV != nil {
				return errV
			}
			stmt.Where("app_version in (?)", selectedVersions.Parameterize())
		}

		stmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")

		rows, err := server.Server.RchPool.Query(sctx, stmt.String(), stmt.Args()...)
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var instance healthInstance
			var datetimeBucket time.Time
			if err := rows.Scan(&datetimeBucket, &instance.DateTime, &instance.Instances); err != nil {
				return err
			}
			if instance.Instances > 0 {
				sessions = append(sessions, instance)
			}
		}

		return rows.Err()
	})

	// crashes (fatal exceptions) & ANRs
	healthGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment": lc.MustPut(logcomment.Root, logcomment.Health).String(),
		}
		ectx := logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "plots_instances")
		const fatalExpr = "(`exception.severity` = 'fatal' OR (`exception.severity` = '' AND `exception.handled` = false))"

		stmt := sqlf.From("events final").
			Select(groupExpr.BucketExpr+" as datetime_bucket", af.Timezone).
			Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
			Select("countIf(type = ? and "+fatalExpr+") as crashes", event.TypeException).
			Select("countIf(type = ?) as anrs", event.TypeANR).
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("timestamp >= ? and timestamp <= ?", af.From, af.To).
			Where("type in (?, ?)", event.TypeException, event.TypeANR)
		defer stmt.Close()

		if af.HasVersions() {
			stmt.Where("attribute.app_version").In(af.Versions)
			stmt.Where("attribute.app_build").In(af.VersionCodes)
		}

		stmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")

		rows, err := server.Server.RchPool.Query(ectx, stmt.String(), stmt.Args()...)
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var datetimeBucket time.Time
			var datetime string
			var crashCount, anrCount uint64
			if err := rows.Scan(&datetimeBucket, &datetime, &crashCount, &anrCount); err != nil {
				return err
			}
			if crashCount > 0 {
				crashes = append(crashes, healthInstance{DateTime: datetime, Instances: crashCount})
			}
			if anrCount > 0 {
				anrs = append(anrs, healthInstance{DateTime: datetime, Instances: anrCount})
			}
		}

		return rows.Err()
	})

	if err = healthGroup.Wait(); err != nil {
		return nil, nil, nil, err
	}

	return
}

func GetHealthOverviewPlotInstances(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `health overview request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if !af.HasTimezone() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing required field `timezone`",
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	sessions, crashes, anrs, err := app.GetHealthPlotInstances(ctx, &af)
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

	build := func(id string, points []healthInstance) series {
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
