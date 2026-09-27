package measure

import (
	"context"

	"backend/libs/chquery"
	"backend/libs/event"
	"backend/libs/journeymap"
	"backend/libs/logcomment"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// journeyMapEventsStmt selects the navigation and tap events of every
// session that captured a layout snapshot, grouped by session and in time
// order.
func (a App) journeyMapEventsStmt() *sqlf.Stmt {
	snapshotted := sqlf.
		From("events").
		Select("distinct session_id").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("position(attachments, ?) > 0", `"`+event.AttachmentTypeLayoutSnapshotJSON+`"`)

	return sqlf.
		From("events").
		With("snapshotted", snapshotted).
		Select("session_id").
		Select("toUnixTimestamp64Milli(timestamp)").
		Select("type").
		Select("`lifecycle_activity.type`").
		Select("`lifecycle_activity.class_name`").
		Select("`lifecycle_fragment.type`").
		Select("`lifecycle_fragment.class_name`").
		Select("`lifecycle_fragment.parent_activity`").
		Select("`lifecycle_view_controller.type`").
		Select("`lifecycle_view_controller.class_name`").
		Select("`lifecycle_swift_ui.type`").
		Select("`lifecycle_swift_ui.class_name`").
		Select("`screen_view.name`").
		Select("`gesture_click.label`").
		Select("`gesture_click.semantic_label`").
		Select("`gesture_click.target_id`").
		Select("`gesture_click.target`").
		Select("attachments").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("session_id in (select session_id from snapshotted)").
		Where("((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` = ?) or (type = ? and `lifecycle_view_controller.type` in ?) or (type = ? and `lifecycle_swift_ui.type` = ?) or type = ? or type = ?)",
			event.TypeLifecycleActivity, []string{event.LifecycleActivityTypeCreated, event.LifecycleActivityTypeResumed},
			event.TypeLifecycleFragment, event.LifecycleFragmentTypeResumed,
			event.TypeLifecycleViewController, []string{event.LifecycleViewControllerTypeViewDidLoad, event.LifecycleViewControllerTypeViewDidAppear},
			event.TypeLifecycleSwiftUI, event.LifecycleSwiftUITypeOnAppear,
			event.TypeScreenView,
			event.TypeGestureClick,
		).
		OrderBy("session_id", "timestamp", "id")
}

// GetJourneyMapEvents returns the navigation and tap events the journey map
// is built from.
func (a App) GetJourneyMapEvents(ctx context.Context, rch driver.Conn) (events []journeymap.Event, err error) {
	stmt := a.journeyMapEventsStmt()
	defer stmt.Close()

	lc := logcomment.New(2)
	lc.MustPut(logcomment.Root, logcomment.Journeys)
	settings := logcomment.Put(clickhouse.Settings{}, lc, logcomment.Name, "journey_map_events")
	ctx = chquery.WithSettings(chquery.WithTeamScope(ctx, a.TeamId), settings)

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var e journeymap.Event
		var sessionID uuid.UUID
		var attachments string
		if err = rows.Scan(
			&sessionID,
			&e.Timestamp,
			&e.Type,
			&e.ActivityState,
			&e.Activity,
			&e.FragmentState,
			&e.Fragment,
			&e.FragmentParent,
			&e.ViewControllerState,
			&e.ViewController,
			&e.SwiftUIState,
			&e.SwiftUI,
			&e.ScreenView,
			&e.ClickLabel,
			&e.ClickSemanticLabel,
			&e.ClickTargetID,
			&e.ClickTarget,
			&attachments,
		); err != nil {
			return
		}
		e.SessionID = sessionID.String()
		if e.Snapshots, err = layoutSnapshotKeys(attachments); err != nil {
			return
		}
		events = append(events, e)
	}

	err = rows.Err()

	return
}

// layoutSnapshotKeys returns the storage keys of the JSON layout snapshots in
// an event's attachments.
func layoutSnapshotKeys(attachments string) ([]string, error) {
	var parsed []event.Attachment
	if err := unmarshalAttachments(attachments, &parsed); err != nil {
		return nil, err
	}
	var keys []string
	for _, a := range parsed {
		if a.Type == event.AttachmentTypeLayoutSnapshotJSON && a.Key != "" {
			keys = append(keys, a.Key)
		}
	}
	return keys, nil
}
