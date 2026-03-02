package group

import (
	"backend/api/ambient"
	"backend/api/chrono"
	"backend/ingest/event"
	"backend/ingest/server"
	"context"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

type GroupType string

const (
	GroupTypeCrash GroupType = "crash"
	GroupTypeANR   GroupType = "anr"
)

// IssueGroup interface represents
// common interface for issue group
// types like ExceptionGroup & ANRGroup.
type IssueGroup interface {
	GetId() string
}

type ExceptionGroup struct {
	AppID       uuid.UUID       `json:"app_id" db:"app_id"`
	ID          string          `json:"id" db:"id"`
	CountryCode string          `json:"country_code"`
	Attribute   event.Attribute `json:"-"`
	Type        string          `json:"type" db:"type"`
	Message     string          `json:"message" db:"message"`
	MethodName  string          `json:"method_name" db:"method_name"`
	FileName    string          `json:"file_name" db:"file_name"`
	LineNumber  int32           `json:"line_number" db:"line_number"`
	Count       uint64          `json:"count"`
	EventIDs    []uuid.UUID     `json:"event_ids,omitempty"`
	Percentage  float64         `json:"percentage_contribution"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

type ANRGroup struct {
	AppID       uuid.UUID       `json:"app_id" db:"app_id"`
	ID          string          `json:"id" db:"id"`
	CountryCode string          `json:"country_code"`
	Attribute   event.Attribute `json:"-"`
	Type        string          `json:"type" db:"type"`
	Message     string          `json:"message" db:"message"`
	MethodName  string          `json:"method_name" db:"method_name"`
	FileName    string          `json:"file_name" db:"file_name"`
	LineNumber  int32           `json:"line_number" db:"line_number"`
	Count       uint64          `json:"count"`
	EventIDs    []uuid.UUID     `json:"event_ids,omitempty"`
	Percentage  float64         `json:"percentage_contribution"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

// GetId provides the exception's
// Id.
func (e ExceptionGroup) GetId() string {
	return e.ID
}

// GetDisplayTitle provides a user friendly display
// name for the Exception Group.
func (e ExceptionGroup) GetDisplayTitle() string {
	return e.Type + "@" + e.FileName
}

// Insert inserts a new ExceptionGroup into the database.
func (e *ExceptionGroup) Insert(ctx context.Context) (err error) {
	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return err
	}

	stmt := sqlf.
		New("insert into unhandled_exception_groups").
		Clause("(").
		Expr("team_id").
		Expr("app_id").
		Expr("id").
		Expr("app_version").
		Expr("type").
		Expr("message").
		Expr("method_name").
		Expr("file_name").
		Expr("line_number").
		Expr("os_versions").
		Expr("country_codes").
		Expr("network_providers").
		Expr("network_types").
		Expr("network_generations").
		Expr("device_locales").
		Expr("device_manufacturers").
		Expr("device_names").
		Expr("device_models").
		Expr("count").
		Expr("timestamp").
		Clause(")").
		Clause("select").
		Expr("toUUID(?)", teamId).
		Expr("toUUID(?)", e.AppID).
		Expr("?", e.ID).
		Expr("(?, ?)", e.Attribute.AppVersion, e.Attribute.AppBuild).
		Expr("?", e.Type).
		Expr("?", e.Message).
		Expr("?", e.MethodName).
		Expr("?", e.FileName).
		Expr("?", e.LineNumber).
		Expr("groupUniqArrayState(tuple(?, ?))", e.Attribute.OSName, e.Attribute.OSVersion).
		Expr("groupUniqArrayState(?)", e.CountryCode).
		Expr("groupUniqArrayState(?)", e.Attribute.NetworkProvider).
		Expr("groupUniqArrayState(?)", e.Attribute.NetworkType).
		Expr("groupUniqArrayState(?)", e.Attribute.NetworkGeneration).
		Expr("groupUniqArrayState(?)", e.Attribute.DeviceLocale).
		Expr("groupUniqArrayState(?)", e.Attribute.DeviceManufacturer).
		Expr("groupUniqArrayState(?)", e.Attribute.DeviceName).
		Expr("groupUniqArrayState(?)", e.Attribute.DeviceModel).
		Expr("sumState(toUInt64(1))").
		Expr("toDateTime64(?, 3, 'UTC')", e.UpdatedAt.Format(chrono.MSTimeFormat))

	defer stmt.Close()

	asyncCtx := clickhouse.Context(ctx, clickhouse.WithAsync(true))
	return server.Server.ChPool.Exec(asyncCtx, stmt.String(), stmt.Args()...)
}

// GetId provides the ANR's
// Id.
func (a ANRGroup) GetId() string {
	return a.ID
}

// GetDisplayTitle provides a user friendly display
// name for the ANR Group.
func (a ANRGroup) GetDisplayTitle() string {
	return a.Type + "@" + a.FileName
}

// Insert inserts a new ANRGroup into the database.
func (a *ANRGroup) Insert(ctx context.Context) (err error) {
	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return err
	}

	stmt := sqlf.
		New("insert into anr_groups").
		Clause("(").
		Expr("team_id").
		Expr("app_id").
		Expr("id").
		Expr("app_version").
		Expr("type").
		Expr("message").
		Expr("method_name").
		Expr("file_name").
		Expr("line_number").
		Expr("os_versions").
		Expr("country_codes").
		Expr("network_providers").
		Expr("network_types").
		Expr("network_generations").
		Expr("device_locales").
		Expr("device_manufacturers").
		Expr("device_names").
		Expr("device_models").
		Expr("count").
		Expr("timestamp").
		Clause(")").
		Clause("select").
		Expr("toUUID(?)", teamId).
		Expr("toUUID(?)", a.AppID).
		Expr("?", a.ID).
		Expr("(?, ?)", a.Attribute.AppVersion, a.Attribute.AppBuild).
		Expr("?", a.Type).
		Expr("?", a.Message).
		Expr("?", a.MethodName).
		Expr("?", a.FileName).
		Expr("?", a.LineNumber).
		Expr("groupUniqArrayState(tuple(?, ?))", a.Attribute.OSName, a.Attribute.OSVersion).
		Expr("groupUniqArrayState(?)", a.CountryCode).
		Expr("groupUniqArrayState(?)", a.Attribute.NetworkProvider).
		Expr("groupUniqArrayState(?)", a.Attribute.NetworkType).
		Expr("groupUniqArrayState(?)", a.Attribute.NetworkGeneration).
		Expr("groupUniqArrayState(?)", a.Attribute.DeviceLocale).
		Expr("groupUniqArrayState(?)", a.Attribute.DeviceManufacturer).
		Expr("groupUniqArrayState(?)", a.Attribute.DeviceName).
		Expr("groupUniqArrayState(?)", a.Attribute.DeviceModel).
		Expr("sumState(toUInt64(1))").
		Expr("toDateTime64(?, 3, 'UTC')", a.UpdatedAt.Format(chrono.MSTimeFormat))

	defer stmt.Close()

	asyncCtx := clickhouse.Context(ctx, clickhouse.WithAsync(true))
	return server.Server.ChPool.Exec(asyncCtx, stmt.String(), stmt.Args()...)
}

// NewExceptionGroup constructs a new ExceptionGroup and returns a pointer to it.
func NewExceptionGroup(appId uuid.UUID, countryCode string, attribute event.Attribute, fingerprint string, exceptionType, message, methodName, fileName string, lineNumber int32, timestamp time.Time) *ExceptionGroup {
	return &ExceptionGroup{
		AppID:       appId,
		CountryCode: countryCode,
		Attribute:   attribute,
		ID:          fingerprint,
		Type:        exceptionType,
		Message:     message,
		MethodName:  methodName,
		FileName:    fileName,
		LineNumber:  lineNumber,
		UpdatedAt:   timestamp,
	}
}

// NewANRGroup constructs a new ANRGroup and returns a pointer to it.
func NewANRGroup(appId uuid.UUID, countryCode string, attribute event.Attribute, fingerprint string, anrType, message, methodName, fileName string, lineNumber int32, timestamp time.Time) *ANRGroup {
	return &ANRGroup{
		AppID:       appId,
		CountryCode: countryCode,
		Attribute:   attribute,
		ID:          fingerprint,
		Type:        anrType,
		Message:     message,
		MethodName:  methodName,
		FileName:    fileName,
		LineNumber:  lineNumber,
		UpdatedAt:   timestamp,
	}
}
