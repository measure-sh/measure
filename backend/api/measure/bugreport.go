package measure

import (
	"backend/api/event"
	"backend/api/filter"
	"backend/api/server"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// BugReport represents a session
type BugReport struct {
	SessionID            uuid.UUID          `json:"session_id" binding:"required"`
	AppID                uuid.UUID          `json:"app_id" binding:"required"`
	EventID              uuid.UUID          `json:"event_id" binding:"required"`
	Status               uint8              `json:"status" binding:"required"`
	Description          string             `json:"description" binding:"required"`
	Timestamp            *time.Time         `json:"timestamp" binding:"required"`
	UpdatedAt            *time.Time         `json:"updated_at" binding:"required"`
	Attribute            *event.Attribute   `json:"attribute" binding:"required"`
	UserDefinedAttribute event.UDAttribute  `json:"user_defined_attribute" binding:"required"`
	Attachments          []event.Attachment `json:"attachments" binding:"required"`
}

// SessionDisplay provides a convenient
// wrapper over BugReport for display purposes.
type BugReportDisplay struct {
	*BugReport
	MatchedFreeText string `json:"matched_free_text"`
}

// BugReportInstance represents an entity
// for plotting bug report instances.
type BugReportInstance struct {
	DateTime  string  `json:"datetime"`
	Version   string  `json:"version"`
	Instances *uint64 `json:"instances"`
}

type BugReportStatusUpdatePayload struct {
	// 0 (closed) or 1 (open). We use pointer to differentiate between 0 and nil,
	//  otherwise a 0 stattus will be treated as nil and validation will fail.
	Status *uint8 `json:"status" binding:"required"`
}

// GetBugReportInstancesPlot provides aggregated bug report instances
// matching various filters.
func GetBugReportInstancesPlot(ctx context.Context, af *filter.AppFilter) (bugReportInstances []BugReportInstance, err error) {
	base := sqlf.From("bug_reports").
		Clause("FINAL").
		Select("event_id").
		Select("app_version").
		Select("timestamp").
		Clause("prewhere app_id = toUUID(?) and timestamp >= ? and timestamp <= ?", af.AppID, af.From, af.To)

	if len(af.BugReportStatuses) > 0 {
		base.Where("status").In(af.BugReportStatuses)
	}

	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err != nil {
			return nil, err
		}

		base.Where("app_version in (?)", selectedVersions.Parameterize())
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return nil, err
		}

		base.Where("os_version in (?)", selectedOSVersions.Parameterize())
	}

	if af.HasCountries() {
		base.Where("country_code in ?", af.Countries)
	}

	if af.HasNetworkProviders() {
		base.Where("network_provider in ?", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		base.Where("network_type in ?", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		base.Where("network_generation in ?", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		base.Where("device_locale in ?", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		base.Where("device_manufacturer in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		base.Where("device_name in ?", af.DeviceNames)
	}

	if af.FreeText != "" {
		freeText := fmt.Sprintf("%%%s%%", af.FreeText)

		// to add/remove items, only modify this slice
		// of query strings. rest of the query exec
		// infra is self adapting.
		matches := []string{
			"user_id like ?",
			"toString(event_id) like ?",
			"toString(session_id) like ?",
			"description like ?",
		}

		// compute arguments automatically
		args := []any{}
		for i := 0; i < len(matches); i++ {
			args = append(args, freeText)
		}

		// run the complex text matching query joined
		// with multiple 'OR' and inject the args
		base.Where(fmt.Sprintf("(%s)", strings.Join(matches, " or ")), args...)
	}

	if af.HasUDExpression() && !af.UDExpression.Empty() {
		subQuery := sqlf.From("user_def_attrs").
			Select("distinct event_id").
			Clause("final").
			Where("app_id = toUUID(?)", af.AppID)
		af.UDExpression.Augment(subQuery)
		base.SubQuery("event_id in (", ")", subQuery)
	}

	base.OrderBy("timestamp desc")
	base.GroupBy("event_id")
	base.GroupBy("app_version")
	base.GroupBy("timestamp")

	stmt := sqlf.
		With("base", base).
		From("base").
		Select("uniq(event_id) instances").
		Select("formatDateTime(timestamp, '%Y-%m-%d', ?) datetime", af.Timezone).
		Select("concat(tupleElement(app_version, 1), ' ', '(', tupleElement(app_version, 2), ')') app_version_fmt").
		GroupBy("app_version, datetime").
		OrderBy("datetime, tupleElement(app_version, 2) desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var bugReportInstance BugReportInstance
		if err = rows.Scan(&bugReportInstance.Instances, &bugReportInstance.DateTime, &bugReportInstance.Version); err != nil {
			return
		}

		bugReportInstances = append(bugReportInstances, bugReportInstance)
	}

	err = rows.Err()

	return
}

// GetBugReportsWithFilter provides bug reports that matches various
// filter criteria in a paginated fashion.
func GetBugReportsWithFilter(ctx context.Context, af *filter.AppFilter) (bugReports []BugReportDisplay, next, previous bool, err error) {
	stmt := sqlf.From("bug_reports").
		Clause("FINAL").
		Select("event_id").
		Select("session_id").
		Select("timestamp").
		Select("updated_at").
		Select("status").
		Select("description").
		Select("tupleElement(app_version, 1)").
		Select("tupleElement(app_version, 2)").
		Select("tupleElement(os_version, 1)").
		Select("tupleElement(os_version, 2)").
		Select("device_manufacturer").
		Select("device_name").
		Select("device_model").
		Select("user_id").
		Clause("prewhere app_id = toUUID(?) and timestamp >= ? and timestamp <= ?", af.AppID, af.From, af.To)

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	if len(af.BugReportStatuses) > 0 {
		stmt.Where("status").In(af.BugReportStatuses)
	}

	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err != nil {
			return bugReports, next, previous, err
		}

		stmt.Where("app_version in (?)", selectedVersions.Parameterize())
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return bugReports, next, previous, err
		}

		stmt.Where("os_version in (?)", selectedOSVersions.Parameterize())
	}

	if af.HasCountries() {
		stmt.Where("country_code in ?", af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Where("network_provider in ?", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Where("network_type in ?", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("network_generation in ?", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("device_locale in ?", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("device_manufacturer in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("device_name in ?", af.DeviceNames)
	}

	if af.HasUDExpression() && !af.UDExpression.Empty() {
		subQuery := sqlf.From("user_def_attrs").
			Select("distinct event_id").
			Clause("final").
			Where("app_id = toUUID(?)", af.AppID)
		af.UDExpression.Augment(subQuery)
		stmt.SubQuery("event_id in (", ")", subQuery)
	}

	stmt.OrderBy("timestamp desc")

	defer stmt.Close()

	if af.FreeText != "" {
		freeText := fmt.Sprintf("%%%s%%", af.FreeText)

		// to add/remove items, only modify this slice
		// of query strings. rest of the query exec
		// infra is self adapting.
		matches := []string{
			"user_id like ?",
			"toString(event_id) like ?",
			"toString(session_id) like ?",
			"description like ?",
		}

		// compute arguments automatically
		args := []any{}
		for i := 0; i < len(matches); i++ {
			args = append(args, freeText)
		}

		// run the complex text matching query joined
		// with multiple 'OR' and inject the args
		stmt.Where(fmt.Sprintf("(%s)", strings.Join(matches, " or ")), args...)
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var bugReport BugReportDisplay
		bugReport.BugReport = new(BugReport)
		bugReport.Attribute = new(event.Attribute)
		bugReport.AppID = af.AppID

		dest := []any{
			&bugReport.EventID,
			&bugReport.SessionID,
			&bugReport.Timestamp,
			&bugReport.UpdatedAt,
			&bugReport.Status,
			&bugReport.Description,
			&bugReport.Attribute.AppVersion,
			&bugReport.Attribute.AppBuild,
			&bugReport.Attribute.OSName,
			&bugReport.Attribute.OSVersion,
			&bugReport.Attribute.DeviceManufacturer,
			&bugReport.Attribute.DeviceName,
			&bugReport.Attribute.DeviceModel,
			&bugReport.Attribute.UserID,
		}

		if err = rows.Scan(dest...); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		// set matched free text results
		bugReport.MatchedFreeText = extractMatches(af.FreeText, bugReport.Attribute.UserID, bugReport.EventID.String(), bugReport.SessionID.String(), bugReport.Description)

		bugReports = append(bugReports, bugReport)
	}

	err = rows.Err()

	resultLen := len(bugReports)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		bugReports = bugReports[:resultLen-1]
		next = true
	}
	if af.Offset > 0 {
		previous = true
	}

	return
}

// ExtractMatches extracts matching text from
// bug report's various fields.
func extractMatches(
	needle, userId string, eventId string, sessionId string, description string,
) (matched string) {
	if needle == "" {
		return
	}

	buff := []string{}
	const sep = " "

	// user id
	if strings.Contains(strings.ToLower(userId), strings.ToLower(needle)) {
		buff = append(buff, fmt.Sprintf("User Id: %s", userId))
	}

	// event id
	if strings.Contains(strings.ToLower(eventId), strings.ToLower(needle)) {
		buff = append(buff, fmt.Sprintf("Bug Report Id: %s", eventId))
	}

	// session id
	if strings.Contains(strings.ToLower(sessionId), strings.ToLower(needle)) {
		buff = append(buff, fmt.Sprintf("Session Id: %s", sessionId))
	}

	// description
	if strings.Contains(strings.ToLower(description), strings.ToLower(needle)) {
		buff = append(buff, fmt.Sprintf("Description: %s", description))
	}

	matched = strings.Join(buff, sep)

	return
}

// GetBugReport fetches a bug report by its event id.
func GetBugReportById(ctx context.Context, bugReportId string) (bugReport BugReport, err error) {
	stmt := sqlf.From("bug_reports").
		Clause("FINAL").
		Select("event_id").
		Select("app_id").
		Select("session_id").
		Select("timestamp").
		Select("updated_at").
		Select("status").
		Select("description").
		Select("tupleElement(app_version, 1)").
		Select("tupleElement(app_version, 2)").
		Select("tupleElement(os_version, 1)").
		Select("tupleElement(os_version, 2)").
		Select("network_provider").
		Select("network_type").
		Select("network_generation").
		Select("device_locale").
		Select("device_manufacturer").
		Select("device_name").
		Select("device_model").
		Select("user_id").
		Select("device_low_power_mode").
		Select("device_thermal_throttling_enabled").
		Select("user_defined_attribute").
		Select("attachments").
		Where("event_id = toUUID(?)", bugReportId)

	defer stmt.Close()

	row := server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...)

	if row.Err() != nil {
		err = row.Err()
		return
	}

	bugReport.Attribute = new(event.Attribute)
	var rawUserDefAttr map[string][]any
	var rawAttachments string

	dest := []any{
		&bugReport.EventID,
		&bugReport.AppID,
		&bugReport.SessionID,
		&bugReport.Timestamp,
		&bugReport.UpdatedAt,
		&bugReport.Status,
		&bugReport.Description,
		&bugReport.Attribute.AppVersion,
		&bugReport.Attribute.AppBuild,
		&bugReport.Attribute.OSName,
		&bugReport.Attribute.OSVersion,
		&bugReport.Attribute.NetworkProvider,
		&bugReport.Attribute.NetworkType,
		&bugReport.Attribute.NetworkGeneration,
		&bugReport.Attribute.DeviceLocale,
		&bugReport.Attribute.DeviceManufacturer,
		&bugReport.Attribute.DeviceName,
		&bugReport.Attribute.DeviceModel,
		&bugReport.Attribute.UserID,
		&bugReport.Attribute.DeviceLowPowerMode,
		&bugReport.Attribute.DeviceThermalThrottlingEnabled,
		&rawUserDefAttr,
		&rawAttachments,
	}

	if err = row.Scan(dest...); err != nil {
		fmt.Println(err)
		return
	}

	// Map rawUserDefAttr
	if len(rawUserDefAttr) > 0 {
		bugReport.UserDefinedAttribute.Scan(rawUserDefAttr)
	}

	// Map rawAttachments
	if err = json.Unmarshal([]byte(rawAttachments), &bugReport.Attachments); err != nil {
		return
	}

	// Presign attachment URLs
	if len(bugReport.Attachments) > 0 {
		for j := range bugReport.Attachments {
			if err = bugReport.Attachments[j].PreSignURL(ctx); err != nil {
				msg := `failed to generate URLs for attachment`
				fmt.Println(msg, err)
				return
			}
		}
	}

	return
}

// UpdateBugReportStatusById updates the status of a bug report by its event id.
func UpdateBugReportStatusById(ctx context.Context, bugReportId string, status uint8) (err error) {
	if status != 0 && status != 1 {
		return fmt.Errorf("invalid status %d. Should be 0 (closed) or 1 (open)", status)
	}

	query := fmt.Sprintf(`
    INSERT INTO bug_reports
    SELECT
    	team_id,
        event_id,
        app_id,
        session_id,
        timestamp,
		now64(9, 'UTC') AS updated_at,
        '%d' AS status,
        description,
        app_version,
        os_version,
        country_code,
        network_provider,
        network_type,
        network_generation,
        device_locale,
        device_manufacturer,
        device_name,
        device_model,
        user_id,
        device_low_power_mode,
        device_thermal_throttling_enabled,
        user_defined_attribute,
        attachments
    FROM bug_reports FINAL
    WHERE event_id = toUUID('%s')
    `, status, bugReportId)

	err = server.Server.ChPool.Exec(ctx, query)

	if err != nil {
		return err
	}

	return
}
