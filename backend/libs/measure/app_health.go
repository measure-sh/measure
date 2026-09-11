package measure

import (
	"context"
	"errors"
	"time"

	"backend/libs/chquery"
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
func (a App) GetHealthPlotInstances(ctx context.Context, rch driver.Conn, flt *filter.Filter) (sessions, crashes, anrs []HealthInstance, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if flt.Timezone == "" {
		return nil, nil, nil, errors.New("missing timezone filter")
	}

	flt.SetDefaultPlotTimeGroupIfUnset()

	groupExpr, err := GetPlotTimeGroupExpr("timestamp", flt.PlotTimeGroup)
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
		sctx := chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "plots_instances"))

		stmt := sqlf.From(config.AppMetricsTable).
			Select(groupExpr.BucketExpr+" as datetime_bucket", flt.Timezone).
			Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
			Select("uniqMerge(unique_sessions) as instances").
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("timestamp >= ? and timestamp <= ?", flt.From, flt.To)
		defer stmt.Close()

		if flt.HasFilterExpr() {
			predicate, predErr := flt.Predicate(nil)
			if predErr != nil {
				return predErr
			}
			defer predicate.Close()
			stmt.Where(predicate.String(), predicate.Args()...)
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
		ectx := chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "plots_instances"))

		stmt := sqlf.From("events final").
			Select(groupExpr.BucketExpr+" as datetime_bucket", flt.Timezone).
			Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
			Select("countIf(type = ? and "+config.FatalExceptionExpr+") as crashes", event.TypeException).
			Select("countIf(type = ?) as anrs", event.TypeANR).
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("timestamp >= ? and timestamp <= ?", flt.From, flt.To).
			Where("type in (?, ?)", event.TypeException, event.TypeANR)
		defer stmt.Close()

		if flt.HasFilterExpr() {
			predicate, predErr := flt.Predicate(filter.AppHealthEventsKeyBindings)
			if predErr != nil {
				return predErr
			}
			defer predicate.Close()
			stmt.Where(predicate.String(), predicate.Args()...)
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
