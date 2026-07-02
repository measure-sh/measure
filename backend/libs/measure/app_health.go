package measure

import (
	"context"
	"errors"
	"time"

	"backend/libs/config"
	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/logcomment"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/leporo/sqlf"
	"golang.org/x/sync/errgroup"
)

// HealthInstance is a single time-bucketed data point for one
// series (sessions, crashes or ANRs) of the health overview plot.
type HealthInstance struct {
	DateTime  string
	Instances uint64
}

// GetHealthPlotInstances computes the sessions, crashes and ANRs time
// series for the health overview plot, bucketed by the filter's plot
// time group.
func (a App) GetHealthPlotInstances(ctx context.Context, rch driver.Conn, af *filter.AppFilter) (sessions, crashes, anrs []HealthInstance, err error) {
	if af.Timezone == "" {
		return nil, nil, nil, errors.New("missing timezone filter")
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := GetPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
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
			// (app_version.1, app_version.2) instead of app_version: a whole-tuple
			// IN crashes on ClickHouse >= 26.2 (code 27) when a set skip index
			// exists on a tuple element subcolumn, as on app_metrics.
			stmt.Where("(app_version.1, app_version.2) in (?)", selectedVersions.Parameterize())
		}

		stmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")

		rows, err := rch.Query(sctx, stmt.String(), stmt.Args()...)
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var instance HealthInstance
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

		rows, err := rch.Query(ectx, stmt.String(), stmt.Args()...)
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
				crashes = append(crashes, HealthInstance{DateTime: datetime, Instances: crashCount})
			}
			if anrCount > 0 {
				anrs = append(anrs, HealthInstance{DateTime: datetime, Instances: anrCount})
			}
		}

		return rows.Err()
	})

	if err = healthGroup.Wait(); err != nil {
		return nil, nil, nil, err
	}

	return
}
