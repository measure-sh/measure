package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Session struct {
	SessionID   uuid.UUID    `json:"session_id" binding:"required"`
	Timestamp   time.Time    `json:"timestamp" binding:"required"`
	Resource    Resource     `json:"resource" binding:"required"`
	Events      []EventField `json:"events" binding:"required"`
	Attachments []Attachment `json:"attachments"`
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

func (s *Session) hasExceptions() bool {
	for _, event := range s.Events {
		if event.isException() {
			return true
		}
	}
	return false
}

func (s *Session) hasANRs() bool {
	for _, event := range s.Events {
		if event.isANR() {
			return true
		}
	}
	return false
}

func (s *Session) hasAppExits() bool {
	for _, event := range s.Events {
		if event.isAppExit() {
			return true
		}
	}
	return false
}

func (s *Session) hasGestureLongClicks() bool {
	for _, event := range s.Events {
		if event.isGestureLongClick() {
			return true
		}
	}
	return false
}

func (s *Session) hasGestureScrolls() bool {
	for _, event := range s.Events {
		if event.isGestureScroll() {
			return true
		}
	}
	return false
}

func (s *Session) hasGestureClicks() bool {
	for _, event := range s.Events {
		if event.isGestureClick() {
			return true
		}
	}
	return false
}

func (s *Session) hasLifecycleActivities() bool {
	for _, event := range s.Events {
		if event.isLifecycleActivity() {
			return true
		}
	}
	return false
}

func (s *Session) hasLifecycleFragments() bool {
	for _, event := range s.Events {
		if event.isLifecycleFragment() {
			return true
		}
	}
	return false
}

func (s *Session) hasAttachments() bool {
	return len(s.Attachments) > 0
}

func (s *Session) needsSymbolication() bool {
	if s.hasExceptions() || s.hasANRs() || s.hasAppExits() || s.hasGestureLongClicks() || s.hasGestureScrolls() || s.hasGestureClicks() || s.hasLifecycleActivities() || s.hasLifecycleFragments() {
		return true
	}
	return false
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

func (s *Session) saveWithContext(c *gin.Context) error {
	bytesIn := c.MustGet("bytesIn")
	tx, err := server.pgPool.Begin(context.Background())
	if err != nil {
		return err
	}

	defer tx.Rollback(context.Background())

	// insert the session
	_, err = tx.Exec(context.Background(), `insert into sessions (id, event_count, attachment_count, bytes_in, timestamp) values ($1, $2, $3, $4, $5);`, s.SessionID, len(s.Events), len(s.Attachments), bytesIn, time.Now())
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

	err = tx.Commit(context.Background())
	if err != nil {
		return err
	}
	return nil
}

func (s *Session) known(id uuid.UUID) (bool, error) {
	var known string
	if err := server.pgPool.QueryRow(context.Background(), `select id from sessions where id = $1;`, s.SessionID).Scan(&known); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (s *Session) getMappingKey() (string, error) {
	var key string
	if err := server.pgPool.QueryRow(context.Background(), `select key from mapping_files where app_id = $1 and version_name = $2 and version_code = $3 and mapping_type = 'proguard' limit 1;`, s.Resource.AppUniqueID, s.Resource.AppVersion, s.Resource.AppBuild).Scan(&key); err != nil {
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

		if event.isGestureLongClick() {
			if len(event.GestureLongClick.Target) > 0 {
				idGestureLongClick := uuid.New()
				unitGLC := NewCodecMapVal()
				unitGLC.Type = TypeGestureLongClick
				unitGLC.Event = eventIdx
				unitGLC.Target = TransformSwap
				codecMap[idGestureLongClick] = *unitGLC
				su := new(SymbolicationUnit)
				su.ID = idGestureLongClick
				su.Values = []string{GenericPrefix + event.GestureLongClick.Target}
				symbolicationUnits = append(symbolicationUnits, *su)
			}
		}

		if event.isGestureScroll() {
			if len(event.GestureScroll.Target) > 0 {
				idGestureScroll := uuid.New()
				unitGS := NewCodecMapVal()
				unitGS.Type = TypeGestureScroll
				unitGS.Event = eventIdx
				unitGS.Target = TransformSwap
				codecMap[idGestureScroll] = *unitGS
				su := new(SymbolicationUnit)
				su.ID = idGestureScroll
				su.Values = []string{GenericPrefix + event.GestureScroll.Target}
				symbolicationUnits = append(symbolicationUnits, *su)
			}
		}

		if event.isGestureClick() {
			if len(event.GestureClick.Target) > 0 {
				idGestureClick := uuid.New()
				unitGC := NewCodecMapVal()
				unitGC.Type = TypeGestureClick
				unitGC.Event = eventIdx
				unitGC.Target = TransformSwap
				codecMap[idGestureClick] = *unitGC
				su := new(SymbolicationUnit)
				su.ID = idGestureClick
				su.Values = []string{GenericPrefix + event.GestureClick.Target}
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
						fmt.Println("anr frame", frame)
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
		case TypeGestureLongClick:
			if codecMapVal.Target == TransformSwap {
				s.Events[codecMapVal.Event].GestureLongClick.Target = strings.TrimPrefix(su.Values[0], GenericPrefix)
			}
		case TypeGestureScroll:
			if codecMapVal.Target == TransformSwap {
				s.Events[codecMapVal.Event].GestureScroll.Target = strings.TrimPrefix(su.Values[0], GenericPrefix)
			}
		case TypeGestureClick:
			if codecMapVal.Target == TransformSwap {
				s.Events[codecMapVal.Event].GestureClick.Target = strings.TrimPrefix(su.Values[0], GenericPrefix)
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
		default:
			continue
		}
	}
}

func putSession(c *gin.Context) {
	bc := &ByteCounter{}
	c.Request.Body = io.NopCloser(io.TeeReader(c.Request.Body, bc))
	session := new(Session)
	if err := c.ShouldBindJSON(&session); err != nil {
		fmt.Println("gin binding err:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse session payload"})
		return
	}

	c.Set("bytesIn", bc.Count)

	if known, err := session.known(session.SessionID); err != nil {
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

	query, args := makeInsertQuery("events_test_2", columns, session)
	if err := server.chPool.AsyncInsert(context.Background(), query, false, args...); err != nil {
		fmt.Println("clickhouse insert err:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := session.saveWithContext(c); err != nil {
		fmt.Println("failed to save session", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save session"})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"ok": "accepted"})
}
