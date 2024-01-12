package measure

import (
	"context"
	"errors"
	"fmt"
	"io"
	"measure-backend/measure-go/inet"
	"measure-backend/measure-go/server"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ipinfo/go/v2/ipinfo"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type Session struct {
	SessionID   uuid.UUID    `json:"session_id" binding:"required"`
	AppID       uuid.UUID    `json:"app_id"`
	Timestamp   time.Time    `json:"timestamp" binding:"required"`
	IPv4        net.IP       `json:"inet_ipv4"`
	IPv6        net.IP       `json:"inet_ipv6"`
	CountryCode string       `json:"inet_country_code"`
	Resource    Resource     `json:"resource" binding:"required"`
	Events      []EventField `json:"events" binding:"required"`
	Attachments []Attachment `json:"attachments"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

func (s *Session) validate() error {
	if err := s.Resource.validate(); err != nil {
		return err
	}

	for _, event := range s.Events {
		if err := event.validate(); err != nil {
			return err
		}
	}

	if s.hasAttachments() {
		for _, attachment := range s.Attachments {
			if err := attachment.validate(); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *Session) hasAttachments() bool {
	return len(s.Attachments) > 0
}

func (s *Session) hasUnhandledExceptions() bool {
	result := false

	for i := range s.Events {
		if s.Events[i].isUnhandledException() {
			result = true
			break
		}
	}

	return result
}

func (s *Session) hasANRs() bool {
	result := false

	for i := range s.Events {
		if s.Events[i].isANR() {
			result = true
			break
		}
	}

	return result
}

func (s *Session) needsSymbolication() bool {
	result := false
	for i := range s.Events {
		if s.Events[i].isException() {
			result = true
			break
		}

		if s.Events[i].isANR() {
			result = true
			break
		}

		if s.Events[i].isAppExit() && len(s.Events[i].AppExit.Trace) > 0 {
			result = true
			break
		}

		if s.Events[i].isLifecycleActivity() && len(s.Events[i].LifecycleActivity.ClassName) > 0 {
			result = true
			break
		}

		if s.Events[i].isColdLaunch() && len(s.Events[i].ColdLaunch.LaunchedActivity) > 0 {
			result = true
			break
		}

		if s.Events[i].isWarmLaunch() && len(s.Events[i].WarmLaunch.LaunchedActivity) > 0 {
			result = true
			break
		}

		if s.Events[i].isHotLaunch() && len(s.Events[i].HotLaunch.LaunchedActivity) > 0 {
			result = true
			break
		}

		if s.Events[i].isLifecycleFragment() {
			hasClassName := len(s.Events[i].LifecycleFragment.ClassName) > 0
			hasParentActivity := len(s.Events[i].LifecycleFragment.ParentActivity) > 0

			if hasClassName || hasParentActivity {
				result = true
				break
			}
		}
	}

	return result
}

func (s *Session) uploadAttachments() error {
	for i, a := range s.Attachments {
		a = a.Prepare()
		result, err := a.upload(s)
		if err != nil {
			return err
		}
		a.Location = result.Location
		s.Attachments[i] = a
	}

	return nil
}

func (s *Session) lookupCountry(rawIP string) error {
	ip := net.ParseIP(rawIP)
	if inet.Isv4(ip) {
		s.IPv4 = ip
	} else {
		s.IPv6 = ip
	}

	country, err := inet.LookupCountry(rawIP)
	if err != nil {
		fmt.Println("failed to lookup country by ip")
		return err
	}

	bogon, err := ipinfo.GetIPBogon(ip)
	if err != nil {
		fmt.Println("failed to lookup bogon ip")
	}

	if bogon {
		s.CountryCode = "bogon"
	} else if *country != "" {
		s.CountryCode = *country
	} else {
		s.CountryCode = "not available"
	}

	return nil
}

func (s *Session) getUnhandledExceptions() []EventField {
	var exceptions []EventField
	for _, event := range s.Events {
		if !event.isException() {
			continue
		}
		if event.Exception.Handled {
			continue
		}
		exceptions = append(exceptions, event)
	}

	return exceptions
}

func (s *Session) getANRs() []EventField {
	var anrs []EventField
	for _, event := range s.Events {
		if !event.isANR() {
			continue
		}
		anrs = append(anrs, event)
	}

	return anrs
}

func (s *Session) bucketUnhandledException() error {
	exceptions := s.getUnhandledExceptions()

	type EventGroup struct {
		eventId     uuid.UUID
		exception   Exception
		fingerprint uint64
	}

	var groups []EventGroup

	for _, event := range exceptions {
		if event.Exception.Fingerprint == "" {
			msg := fmt.Sprintf("fingerprint for event %q is empty, cannot bucket", event.ID)
			fmt.Println(msg)
			continue
		}

		fingerprint, err := strconv.ParseUint(event.Exception.Fingerprint, 16, 64)
		if err != nil {
			msg := fmt.Sprintf("failed to parse fingerprint as integer for event %q", event.ID)
			fmt.Println(msg, err)
			return err
		}

		groups = append(groups, EventGroup{
			eventId:     event.ID,
			exception:   event.Exception,
			fingerprint: fingerprint,
		})
	}

	app := App{
		ID: &s.AppID,
	}

	for _, group := range groups {
		appExceptionGroups, err := app.GetExceptionGroups(nil)
		if err != nil {
			return err
		}

		if len(appExceptionGroups) < 1 {
			// insert new exception group
			return NewExceptionGroup(s.AppID, s.Resource.AppVersion, group.exception.getType(), fmt.Sprintf("%x", group.fingerprint), []uuid.UUID{group.eventId}).Insert()
		}

		index, err := ClosestExceptionGroup(appExceptionGroups, group.fingerprint)
		if err != nil {
			return err
		}
		if index < 0 {
			// when no group matches exists, create new exception group
			NewExceptionGroup(s.AppID, s.Resource.AppVersion, group.exception.getType(), fmt.Sprintf("%x", group.fingerprint), []uuid.UUID{group.eventId}).Insert()
			continue
		}
		matchedGroup := appExceptionGroups[index]

		if matchedGroup.EventExists(group.eventId) {
			continue
		}

		if err := matchedGroup.AppendEventId(group.eventId); err != nil {
			return err
		}
	}

	return nil
}

func (s *Session) bucketANRs() error {
	anrs := s.getANRs()

	type EventGroup struct {
		eventId     uuid.UUID
		anr         ANR
		fingerprint uint64
	}

	var groups []EventGroup

	for _, event := range anrs {
		if event.ANR.Fingerprint == "" {
			msg := fmt.Sprintf("fingerprint for anr event %q is empty, cannot bucket", event.ID)
			fmt.Println(msg)
			continue
		}

		fingerprint, err := strconv.ParseUint(event.ANR.Fingerprint, 16, 64)
		if err != nil {
			msg := fmt.Sprintf("failed to parse fingerprint as integer for anr event %q", event.ID)
			fmt.Println(msg, err)
			return err
		}

		groups = append(groups, EventGroup{
			eventId:     event.ID,
			anr:         event.ANR,
			fingerprint: fingerprint,
		})
	}

	app := App{
		ID: &s.AppID,
	}

	for _, group := range groups {
		appANRGroups, err := app.GetANRGroups(nil)
		if err != nil {
			return err
		}

		if len(appANRGroups) < 1 {
			// insert new anr group
			return NewANRGroup(s.AppID, s.Resource.AppVersion, group.anr.getType(), fmt.Sprintf("%x", group.fingerprint), []uuid.UUID{group.eventId}).Insert()
		}

		index, err := ClosestANRGroup(appANRGroups, group.fingerprint)
		if err != nil {
			return err
		}
		if index < 0 {
			// when no group matches exists, create new anr group
			NewANRGroup(s.AppID, s.Resource.AppVersion, group.anr.getType(), fmt.Sprintf("%x", group.fingerprint), []uuid.UUID{group.eventId}).Insert()
			continue
		}
		matchedGroup := appANRGroups[index]

		if matchedGroup.EventExists(group.eventId) {
			continue
		}

		if err := matchedGroup.AppendEventId(group.eventId); err != nil {
			return err
		}
	}

	return nil
}

func (s *Session) saveWithContext(c *gin.Context) error {
	bytesIn := c.MustGet("bytesIn")
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := "error parsing app's uuid"
		fmt.Println(msg, err)
		return err
	}

	app := &App{
		ID: &appId,
	}
	if app, err = app.get(); err != nil {
		msg := "failed to get app"
		fmt.Println(msg, err)
		return err
	}

	tx, err := server.Server.PgPool.Begin(context.Background())
	if err != nil {
		return err
	}

	defer tx.Rollback(context.Background())
	now := time.Now()

	stmt := sqlf.PostgreSQL.InsertInto("public.sessions").
		Set("id", nil).
		Set("event_count", nil).
		Set("attachment_count", nil).
		Set("bytes_in", nil).
		Set("timestamp", nil).
		Set("app_id", nil).
		Set("created_at", nil).
		Set("updated_at", nil)

	defer stmt.Close()

	// insert the session
	_, err = tx.Exec(context.Background(), stmt.String(), s.SessionID, len(s.Events), len(s.Attachments), bytesIn, s.Timestamp, appId, now, now)
	if err != nil {
		fmt.Println(`failed to write session to db`, err.Error())
		return err
	}

	// if attachments are present, insert them
	if s.hasAttachments() {
		sql := `insert into sessions_attachments (id, session_id, name, extension, type, key, location, timestamp) values `
		var values [][]interface{}
		for _, a := range s.Attachments {
			values = append(values, []interface{}{a.ID, s.SessionID, a.Name, a.Extension, a.Type, a.Key, a.Location, a.Timestamp})
		}
		var args []interface{}
		for i, row := range values {
			if i > 0 {
				sql += ", "
			}
			sql += "("
			for j, value := range row {
				if j > 0 {
					sql += ", "
				}
				sql += "$" + strconv.Itoa(i*len(row)+j+1)
				args = append(args, value)
			}
			sql += ")"
		}

		_, err := tx.Exec(context.Background(), sql, args...)
		if err != nil {
			return err
		}
	}

	if !app.Onboarded {
		uniqueIdentifier := s.Resource.AppUniqueID
		platform := s.Resource.Platform
		firstVersion := s.Resource.AppVersion

		if err := app.Onboard(tx, uniqueIdentifier, platform, firstVersion); err != nil {
			return err
		}
	}

	err = tx.Commit(context.Background())
	if err != nil {
		return err
	}
	return nil
}

func (s *Session) known() (bool, error) {
	var known string
	if err := server.Server.PgPool.QueryRow(context.Background(), `select id from sessions where id = $1 and app_id = $2;`, s.SessionID, s.AppID).Scan(&known); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (s *Session) getMappingKey() (string, error) {
	var key string
	if err := server.Server.PgPool.QueryRow(context.Background(), `select key from mapping_files where app_unique_id = $1 and version_name = $2 and version_code = $3 and mapping_type = 'proguard' limit 1;`, s.Resource.AppUniqueID, s.Resource.AppVersion, s.Resource.AppBuild).Scan(&key); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return key, nil
}

func (s *Session) EncodeForSymbolication() (CodecMap, []SymbolicationUnit) {
	var symbolicationUnits []SymbolicationUnit
	codecMap := make(CodecMap)

	for eventIdx, event := range s.Events {
		if event.isException() {
			for exceptionIdx, ex := range event.Exception.Exceptions {
				if len(ex.Frames) > 0 {
					idException := uuid.New()
					unitEx := NewCodecMapVal()
					unitEx.Type = TypeException
					unitEx.Event = eventIdx
					unitEx.Exception = exceptionIdx
					unitEx.Frames = TransformSwap
					codecMap[idException] = *unitEx
					su := new(SymbolicationUnit)
					su.ID = idException
					for _, frame := range ex.Frames {
						su.Values = append(su.Values, MarshalRetraceFrame(frame, FramePrefix))
					}
					symbolicationUnits = append(symbolicationUnits, *su)
				}
				if len(ex.Type) > 0 {
					idExceptionType := uuid.New()
					unitExType := NewCodecMapVal()
					unitExType.Type = TypeException
					unitExType.Event = eventIdx
					unitExType.Exception = exceptionIdx
					unitExType.ExceptionType = TransformSwap
					codecMap[idExceptionType] = *unitExType
					su := new(SymbolicationUnit)
					su.ID = idExceptionType
					su.Values = []string{GenericPrefix + ex.Type}
					symbolicationUnits = append(symbolicationUnits, *su)
				}
			}
			for threadIdx, ex := range event.Exception.Threads {
				if len(ex.Frames) > 0 {
					idThread := uuid.New()
					unitTh := NewCodecMapVal()
					unitTh.Type = TypeException
					unitTh.Event = eventIdx
					unitTh.Thread = threadIdx
					unitTh.Frames = TransformSwap
					codecMap[idThread] = *unitTh
					su := new(SymbolicationUnit)
					su.ID = idThread
					for _, frame := range ex.Frames {
						su.Values = append(su.Values, MarshalRetraceFrame(frame, FramePrefix))
					}
					symbolicationUnits = append(symbolicationUnits, *su)
				}
			}
		}

		if event.isANR() {
			for exceptionIdx, ex := range event.ANR.Exceptions {
				if len(ex.Frames) > 0 {
					idException := uuid.New()
					unitEx := NewCodecMapVal()
					unitEx.Type = TypeANR
					unitEx.Event = eventIdx
					unitEx.Exception = exceptionIdx
					unitEx.Frames = TransformSwap
					codecMap[idException] = *unitEx
					su := new(SymbolicationUnit)
					su.ID = idException
					for _, frame := range ex.Frames {
						su.Values = append(su.Values, MarshalRetraceFrame(frame, FramePrefix))
					}
					symbolicationUnits = append(symbolicationUnits, *su)
				}
				if len(ex.Type) > 0 {
					idExceptionType := uuid.New()
					unitExType := NewCodecMapVal()
					unitExType.Type = TypeANR
					unitExType.Event = eventIdx
					unitExType.Exception = exceptionIdx
					unitExType.ExceptionType = TransformSwap
					codecMap[idExceptionType] = *unitExType
					su := new(SymbolicationUnit)
					su.ID = idExceptionType
					su.Values = []string{GenericPrefix + ex.Type}
					symbolicationUnits = append(symbolicationUnits, *su)
				}
			}
			for threadIdx, ex := range event.ANR.Threads {
				if len(ex.Frames) > 0 {
					idThread := uuid.New()
					unitTh := NewCodecMapVal()
					unitTh.Type = TypeANR
					unitTh.Event = eventIdx
					unitTh.Thread = threadIdx
					unitTh.Frames = TransformSwap
					codecMap[idThread] = *unitTh
					su := new(SymbolicationUnit)
					su.ID = idThread
					for _, frame := range ex.Frames {
						su.Values = append(su.Values, MarshalRetraceFrame(frame, FramePrefix))
					}
					symbolicationUnits = append(symbolicationUnits, *su)
				}
			}
		}

		if event.isAppExit() {
			if len(event.AppExit.Trace) > 0 {
				idAppExit := uuid.New()
				unitAE := NewCodecMapVal()
				unitAE.Type = TypeAppExit
				unitAE.Event = eventIdx
				unitAE.Trace = TransformSwap
				codecMap[idAppExit] = *unitAE
				su := new(SymbolicationUnit)
				su.ID = idAppExit
				su.Values = []string{GenericPrefix + event.AppExit.Trace}
				symbolicationUnits = append(symbolicationUnits, *su)
			}
		}

		if event.isLifecycleActivity() {
			if len(event.LifecycleActivity.ClassName) > 0 {
				idLifecycleActivity := uuid.New()
				unitLA := NewCodecMapVal()
				unitLA.Type = TypeLifecycleActivity
				unitLA.Event = eventIdx
				unitLA.ClassName = TransformSwap
				codecMap[idLifecycleActivity] = *unitLA
				su := new(SymbolicationUnit)
				su.ID = idLifecycleActivity
				su.Values = []string{GenericPrefix + event.LifecycleActivity.ClassName}
				symbolicationUnits = append(symbolicationUnits, *su)
			}
		}

		if event.isLifecycleFragment() {
			if len(event.LifecycleFragment.ClassName) > 0 {
				idLifecycleFragment := uuid.New()
				unitLF := NewCodecMapVal()
				unitLF.Type = TypeLifecycleFragment
				unitLF.Event = eventIdx
				unitLF.ClassName = TransformSwap
				codecMap[idLifecycleFragment] = *unitLF
				su := new(SymbolicationUnit)
				su.ID = idLifecycleFragment
				su.Values = []string{GenericPrefix + event.LifecycleFragment.ClassName}
				symbolicationUnits = append(symbolicationUnits, *su)
			}

			if len(event.LifecycleFragment.ParentActivity) > 0 {
				idLifecycleFragment := uuid.New()
				unitLF := NewCodecMapVal()
				unitLF.Type = TypeLifecycleFragment
				unitLF.Event = eventIdx
				unitLF.ParentActivity = TransformSwap
				codecMap[idLifecycleFragment] = *unitLF
				su := new(SymbolicationUnit)
				su.ID = idLifecycleFragment
				su.Values = []string{GenericPrefix + event.LifecycleFragment.ParentActivity}
				symbolicationUnits = append(symbolicationUnits, *su)
			}
		}

		if event.isColdLaunch() {
			if len(event.ColdLaunch.LaunchedActivity) > 0 {
				idColdLaunch := uuid.New()
				unitCL := NewCodecMapVal()
				unitCL.Type = TypeColdLaunch
				unitCL.Event = eventIdx
				unitCL.LaunchedActivity = TransformSwap
				codecMap[idColdLaunch] = *unitCL
				su := new(SymbolicationUnit)
				su.ID = idColdLaunch
				su.Values = []string{GenericPrefix + event.ColdLaunch.LaunchedActivity}
				symbolicationUnits = append(symbolicationUnits, *su)
			}
		}
		if event.isWarmLaunch() {
			if len(event.WarmLaunch.LaunchedActivity) > 0 {
				idWarmLaunch := uuid.New()
				unitCL := NewCodecMapVal()
				unitCL.Type = TypeWarmLaunch
				unitCL.Event = eventIdx
				unitCL.LaunchedActivity = TransformSwap
				codecMap[idWarmLaunch] = *unitCL
				su := new(SymbolicationUnit)
				su.ID = idWarmLaunch
				su.Values = []string{GenericPrefix + event.WarmLaunch.LaunchedActivity}
				symbolicationUnits = append(symbolicationUnits, *su)
			}
		}
		if event.isHotLaunch() {
			if len(event.HotLaunch.LaunchedActivity) > 0 {
				idHotLaunch := uuid.New()
				unitCL := NewCodecMapVal()
				unitCL.Type = TypeHotLaunch
				unitCL.Event = eventIdx
				unitCL.LaunchedActivity = TransformSwap
				codecMap[idHotLaunch] = *unitCL
				su := new(SymbolicationUnit)
				su.ID = idHotLaunch
				su.Values = []string{GenericPrefix + event.HotLaunch.LaunchedActivity}
				symbolicationUnits = append(symbolicationUnits, *su)
			}
		}
	}

	return codecMap, symbolicationUnits
}

func (s *Session) DecodeFromSymbolication(codecMap CodecMap, symbolicationUnits []SymbolicationUnit) {
	for _, su := range symbolicationUnits {
		codecMapVal := codecMap[su.ID]
		switch codecMapVal.Type {
		case TypeException:
			if codecMapVal.Frames == TransformSwap {
				if codecMapVal.Exception > -1 {
					var frames Frames
					for _, value := range su.Values {
						frame, err := UnmarshalRetraceFrame(value, FramePrefix)
						if err != nil {
							fmt.Println("failed to unmarshal retrace frame", err)
							continue
						}
						frames = append(frames, Frame{
							ClassName:  frame.ClassName,
							LineNum:    frame.LineNum,
							FileName:   frame.FileName,
							MethodName: frame.MethodName,
						})
					}
					s.Events[codecMapVal.Event].Exception.Exceptions[codecMapVal.Exception].Frames = frames
				}

				if codecMapVal.Thread > -1 {
					var frames Frames
					for _, value := range su.Values {
						frame, err := UnmarshalRetraceFrame(value, FramePrefix)
						if err != nil {
							fmt.Println("failed to unmarshal retrace frame", err)
							continue
						}
						frames = append(frames, Frame{
							ClassName:  frame.ClassName,
							LineNum:    frame.LineNum,
							FileName:   frame.FileName,
							MethodName: frame.MethodName,
						})
					}
					s.Events[codecMapVal.Event].Exception.Threads[codecMapVal.Thread].Frames = frames
				}
			}

			if codecMapVal.ExceptionType == TransformSwap {
				exceptionType := strings.TrimPrefix(su.Values[0], GenericPrefix)
				s.Events[codecMapVal.Event].Exception.Exceptions[codecMapVal.Exception].Type = exceptionType
			}
		case TypeANR:
			if codecMapVal.Frames == TransformSwap {
				if codecMapVal.Exception > -1 {
					var frames Frames
					for _, value := range su.Values {
						frame, err := UnmarshalRetraceFrame(value, FramePrefix)
						if err != nil {
							fmt.Println("failed to unmarshal retrace frame", err)
							continue
						}
						frames = append(frames, Frame{
							ClassName:  frame.ClassName,
							LineNum:    frame.LineNum,
							FileName:   frame.FileName,
							MethodName: frame.MethodName,
						})
					}
					s.Events[codecMapVal.Event].ANR.Exceptions[codecMapVal.Exception].Frames = frames
				}

				if codecMapVal.Thread > -1 {
					var frames Frames
					for _, value := range su.Values {
						frame, err := UnmarshalRetraceFrame(value, FramePrefix)
						if err != nil {
							fmt.Println("failed to unmarshal retrace frame", err)
							continue
						}
						frames = append(frames, Frame{
							ClassName:  frame.ClassName,
							LineNum:    frame.LineNum,
							FileName:   frame.FileName,
							MethodName: frame.MethodName,
						})
					}
					s.Events[codecMapVal.Event].ANR.Threads[codecMapVal.Thread].Frames = frames
				}
			}

			if codecMapVal.ExceptionType == TransformSwap {
				exceptionType := strings.TrimPrefix(su.Values[0], GenericPrefix)
				s.Events[codecMapVal.Event].ANR.Exceptions[codecMapVal.Exception].Type = exceptionType
			}
		case TypeAppExit:
			if codecMapVal.Trace == TransformSwap {
				s.Events[codecMapVal.Event].AppExit.Trace = strings.TrimPrefix(su.Values[0], GenericPrefix)
			}
		case TypeLifecycleActivity:
			if codecMapVal.ClassName == TransformSwap {
				s.Events[codecMapVal.Event].LifecycleActivity.ClassName = strings.TrimPrefix(su.Values[0], GenericPrefix)
			}
		case TypeLifecycleFragment:
			if codecMapVal.ClassName == TransformSwap {
				s.Events[codecMapVal.Event].LifecycleFragment.ClassName = strings.TrimPrefix(su.Values[0], GenericPrefix)
			}
			if codecMapVal.ParentActivity == TransformSwap {
				s.Events[codecMapVal.Event].LifecycleFragment.ParentActivity = strings.TrimPrefix(su.Values[0], GenericPrefix)
			}
		case TypeColdLaunch:
			if codecMapVal.LaunchedActivity == TransformSwap {
				s.Events[codecMapVal.Event].ColdLaunch.LaunchedActivity = strings.TrimPrefix(su.Values[0], GenericPrefix)
			}
		case TypeWarmLaunch:
			if codecMapVal.LaunchedActivity == TransformSwap {
				s.Events[codecMapVal.Event].WarmLaunch.LaunchedActivity = strings.TrimPrefix(su.Values[0], GenericPrefix)
			}
		case TypeHotLaunch:
			if codecMapVal.LaunchedActivity == TransformSwap {
				s.Events[codecMapVal.Event].HotLaunch.LaunchedActivity = strings.TrimPrefix(su.Values[0], GenericPrefix)
			}

		default:
			continue
		}
	}
}

func PutSession(c *gin.Context) {
	bc := &ByteCounter{}
	c.Request.Body = io.NopCloser(io.TeeReader(c.Request.Body, bc))
	session := new(Session)
	if err := c.ShouldBindJSON(&session); err != nil {
		fmt.Println("gin binding err:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse session payload"})
		return
	}

	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := "error parsing app's uuid"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to ingest session"})
		return
	}

	session.AppID = appId

	c.Set("bytesIn", bc.Count)

	if known, err := session.known(); err != nil {
		fmt.Println("failed to check existing session", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to ingest session"})
		return
	} else if known {
		c.JSON(http.StatusAccepted, gin.H{"ok": "accepted, known session"})
		return
	}

	if err := session.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// look up country from ip
	if err := session.lookupCountry(c.ClientIP()); err != nil {
		msg := fmt.Sprintf("failed to lookup country for IP %q", c.ClientIP())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not upload session, failed to lookup country by IP"})
		return

	}

	if session.needsSymbolication() {
		if err := symbolicate(session); err != nil {
			fmt.Println("symbolication failed with error", err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not upload session, failed to symbolicate"})
			return
		}
	}

	if session.hasAttachments() {
		if err := session.uploadAttachments(); err != nil {
			fmt.Println("error uploading attachment", err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload attachment(s)"})
			return
		}
	}

	query, args := makeInsertQuery("events", columns, session)
	if err := server.Server.ChPool.AsyncInsert(context.Background(), query, false, args...); err != nil {
		fmt.Println("clickhouse insert err:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := session.saveWithContext(c); err != nil {
		fmt.Println("failed to save session", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save session"})
		return
	}

	if session.hasUnhandledExceptions() {
		if err := session.bucketUnhandledException(); err != nil {
			msg := "failed to save session, error occurred during exception grouping"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}
	}

	if session.hasANRs() {
		if err := session.bucketANRs(); err != nil {
			msg := "failed to save session, error occurred during anr grouping"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

	}

	c.JSON(http.StatusAccepted, gin.H{"ok": "accepted"})
}
