package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SymbolFrame Frame

func (sf *SymbolFrame) MarshalJSON() ([]byte, error) {
	return json.Marshal(MarshalRetraceFrame(*sf))
}

func (sf *SymbolFrame) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}

	f, err := UnmarshalRetraceFrame(s)
	if err != nil {
		return err
	}

	sf.ClassName = f.ClassName
	sf.MethodName = f.MethodName
	sf.FileName = f.FileName
	sf.LineNum = f.LineNum
	return nil
}

type SymbolExceptionUnit struct {
	Type    string        `json:"type"`
	Message string        `json:"message"`
	Frames  []SymbolFrame `json:"frames"`
}

type SymbolThread struct {
	Name   string        `json:"name"`
	Frames []SymbolFrame `json:"frames"`
}

type SymbolException struct {
	ThreadName string                `json:"thread_name"`
	Exceptions []SymbolExceptionUnit `json:"exceptions"`
	Threads    []SymbolThread        `json:"threads"`
}

type SymbolANR struct {
	ThreadName string                `json:"thread_name"`
	Exceptions []SymbolExceptionUnit `json:"exceptions"`
	Threads    []SymbolThread        `json:"threads"`
}

type SymbolExceptionEvent struct {
	Type            string          `json:"type"`
	SymbolException SymbolException `json:"exception"`
}

type SymbolANREvent struct {
	Type      string    `json:"type"`
	SymbolANR SymbolANR `json:"anr"`
}

type SymbolAppExitEvent struct {
	Trace string `json:"trace"`
}

type SymbolicationRequest struct {
	Id                    uuid.UUID              `json:"id"`
	SessionID             uuid.UUID              `json:"session_id"`
	MappingType           string                 `json:"mapping_type"`
	Key                   string                 `json:"key"`
	SymbolANREvents       []SymbolANREvent       `json:"anr_events"`
	SymbolExceptionEvents []SymbolExceptionEvent `json:"exception_events"`
	SymbolAppExitEvents   []SymbolAppExitEvent   `json:"app_exit_events"`
}

type SymbolicationResult struct {
	Id              uuid.UUID            `json:"id"`
	SessionID       uuid.UUID            `json:"session_id"`
	MappingType     string               `json:"mapping_type"`
	Key             string               `json:"key"`
	ANREvents       string               `json:"anr_events"`
	ExceptionEvents string               `json:"exception_events"`
	AppExitEvents   []SymbolAppExitEvent `json:"app_exit_events"`
}

func symbolicate(s *Session) error {
	obfuscatedEvents := s.getObfuscatedEvents()
	if len(obfuscatedEvents) < 1 {
		return nil
	}
	var id uuid.UUID
	var mappingType string
	var key string
	if err := server.pgPool.QueryRow(context.Background(), `select id, mapping_type, key from mapping_files where app_id = $1 and version_name = $2 and version_code = $3 limit 1;`, s.Resource.AppUniqueID, s.Resource.AppVersion, s.Resource.AppBuild).Scan(&id, &mappingType, &key); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		} else {
			return err
		}
	}

	var symbolANREvents []SymbolANREvent
	var symbolExceptionEvents []SymbolExceptionEvent
	var symbolAppExitEvents []SymbolAppExitEvent

	for _, event := range obfuscatedEvents {
		if event.isANR() {
			var symbolExceptionsUnits []SymbolExceptionUnit
			for _, exceptionUnit := range event.ANR.Exceptions {
				var symbolFrames []SymbolFrame
				for _, frame := range exceptionUnit.Frames {
					symbolFrames = append(symbolFrames, SymbolFrame(frame))
				}
				symbolExceptionsUnits = append(symbolExceptionsUnits, SymbolExceptionUnit{
					Type:    exceptionUnit.Type,
					Message: exceptionUnit.Message,
					Frames:  symbolFrames,
				})
			}
			var symbolThreads []SymbolThread
			for _, thread := range event.ANR.Threads {
				var symbolFrames []SymbolFrame
				for _, frame := range thread.Frames {
					symbolFrames = append(symbolFrames, SymbolFrame(frame))
				}
				symbolThreads = append(symbolThreads, SymbolThread{
					Name:   thread.Name,
					Frames: symbolFrames,
				})
			}
			symbolANREvents = append(symbolANREvents, SymbolANREvent{
				Type: event.Type,
				SymbolANR: SymbolANR{
					ThreadName: event.ANR.ThreadName,
					Exceptions: symbolExceptionsUnits,
					Threads:    symbolThreads,
				},
			})

		}
		if event.isException() {
			var symbolExceptionsUnits []SymbolExceptionUnit
			for _, exceptionUnit := range event.Exception.Exceptions {
				var symbolFrames []SymbolFrame
				for _, frame := range exceptionUnit.Frames {
					symbolFrames = append(symbolFrames, SymbolFrame(frame))
				}
				symbolExceptionsUnits = append(symbolExceptionsUnits, SymbolExceptionUnit{
					Type:    exceptionUnit.Type,
					Message: exceptionUnit.Message,
					Frames:  symbolFrames,
				})
			}
			var symbolThreads []SymbolThread
			for _, thread := range event.Exception.Threads {
				var symbolFrames []SymbolFrame
				for _, frame := range thread.Frames {
					symbolFrames = append(symbolFrames, SymbolFrame(frame))
				}
				symbolThreads = append(symbolThreads, SymbolThread{
					Name:   thread.Name,
					Frames: symbolFrames,
				})
			}
			symbolExceptionEvents = append(symbolExceptionEvents, SymbolExceptionEvent{
				Type: event.Type,
				SymbolException: SymbolException{
					ThreadName: event.Exception.ThreadName,
					Exceptions: symbolExceptionsUnits,
					Threads:    symbolThreads,
				},
			})
		}

		if event.isAppExit() {
			symbolAppExitEvents = append(symbolAppExitEvents, SymbolAppExitEvent{
				Trace: event.AppExit.Trace,
			})
		}
	}

	payload := &SymbolicationRequest{
		Id:                    id,
		SessionID:             s.SessionID,
		MappingType:           mappingType,
		Key:                   key,
		SymbolANREvents:       symbolANREvents,
		SymbolExceptionEvents: symbolExceptionEvents,
		SymbolAppExitEvents:   symbolAppExitEvents,
	}

	symbolicateUrl, err := url.JoinPath(os.Getenv("SYMBOLICATOR_ORIGIN"), "symbolicate")
	if err != nil {
		fmt.Println("could not form URL for symbolicator", err.Error())
		return err
	}
	data, err := json.Marshal(payload)
	if err != nil {
		fmt.Println("failed to create symbolication request", err.Error())
		return err
	}

	req, err := http.NewRequest("POST", symbolicateUrl, bytes.NewBuffer(data))
	if err != nil {
		fmt.Println(err)
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println(err)
		return err
	}
	defer resp.Body.Close()
	fmt.Println("symbolicator response status", resp.Status)

	var symbolResult SymbolicationResult
	err = json.NewDecoder(resp.Body).Decode(&symbolResult)
	if err != nil {
		fmt.Println("failed to read symbolicator response", err)
		return err
	}

	anrEventIdxs := []int{}
	exceptionEventIdxs := []int{}
	appExitEventIdxs := []int{}
	for idx, event := range s.Events {
		if !event.symbolicatable() {
			continue
		}
		if event.isANR() {
			anrEventIdxs = append(anrEventIdxs, idx)
		}
		if event.isException() {
			exceptionEventIdxs = append(exceptionEventIdxs, idx)
		}
		if event.isAppExit() {
			appExitEventIdxs = append(appExitEventIdxs, idx)
		}
	}

	var symbolANRResultEvents []SymbolANREvent
	if symbolResult.ANREvents != "" {
		if err := json.Unmarshal([]byte(symbolResult.ANREvents), &symbolANRResultEvents); err != nil {
			fmt.Println("failed to unmarshal symbolicated anr events", err)
			return err
		}
	}

	var symbolExceptionResultEvents []SymbolExceptionEvent
	if symbolResult.ExceptionEvents != "" {
		if err := json.Unmarshal([]byte(symbolResult.ExceptionEvents), &symbolExceptionResultEvents); err != nil {
			fmt.Println("failed to unmarshal symbolicated exception events", err)
			return err
		}
	}

	for seq, idx := range anrEventIdxs {
		symbolicatedANREvent := symbolANRResultEvents[seq]
		mergeANREvent(&symbolicatedANREvent, &s.Events[idx])
	}

	for seq, idx := range exceptionEventIdxs {
		symbolicatedExceptionEvent := symbolExceptionResultEvents[seq]
		mergeExceptionEvent(&symbolicatedExceptionEvent, &s.Events[idx])
	}

	for seq, idx := range appExitEventIdxs {
		symbolicatedAppExitEvent := symbolResult.AppExitEvents[seq]
		mergeAppExitEvent(&symbolicatedAppExitEvent, &s.Events[idx])
	}

	return nil
}

// mergeEvent copies each field from SymbolFrame to the origin session's
// underlying Frame struct
func mergeANREvent(s *SymbolANREvent, d *EventField) {
	for i, exception := range d.ANR.Exceptions {
		for j := range exception.Frames {
			exception.Frames[j].ClassName = s.SymbolANR.Exceptions[i].Frames[j].ClassName
			exception.Frames[j].FileName = s.SymbolANR.Exceptions[i].Frames[j].FileName
			exception.Frames[j].MethodName = s.SymbolANR.Exceptions[i].Frames[j].MethodName
			exception.Frames[j].ModuleName = s.SymbolANR.Exceptions[i].Frames[j].ModuleName
			exception.Frames[j].LineNum = s.SymbolANR.Exceptions[i].Frames[j].LineNum
			exception.Frames[j].ColNum = s.SymbolANR.Exceptions[i].Frames[j].ColNum
		}
	}

	for i, thread := range d.Exception.Threads {
		for j := range thread.Frames {
			thread.Frames[j].ClassName = s.SymbolANR.Threads[i].Frames[j].ClassName
			thread.Frames[j].FileName = s.SymbolANR.Threads[i].Frames[j].FileName
			thread.Frames[j].MethodName = s.SymbolANR.Threads[i].Frames[j].MethodName
			thread.Frames[j].ModuleName = s.SymbolANR.Threads[i].Frames[j].ModuleName
			thread.Frames[j].LineNum = s.SymbolANR.Threads[i].Frames[j].LineNum
			thread.Frames[j].ColNum = s.SymbolANR.Threads[i].Frames[j].ColNum
		}
	}
}

// mergeEvent copies each field from SymbolFrame to the origin session's
// underlying Frame struct
func mergeExceptionEvent(s *SymbolExceptionEvent, d *EventField) {
	for i, exception := range d.Exception.Exceptions {
		for j := range exception.Frames {
			exception.Frames[j].ClassName = s.SymbolException.Exceptions[i].Frames[j].ClassName
			exception.Frames[j].FileName = s.SymbolException.Exceptions[i].Frames[j].FileName
			exception.Frames[j].MethodName = s.SymbolException.Exceptions[i].Frames[j].MethodName
			exception.Frames[j].ModuleName = s.SymbolException.Exceptions[i].Frames[j].ModuleName
			exception.Frames[j].LineNum = s.SymbolException.Exceptions[i].Frames[j].LineNum
			exception.Frames[j].ColNum = s.SymbolException.Exceptions[i].Frames[j].ColNum
		}
	}

	for i, thread := range d.Exception.Threads {
		for j := range thread.Frames {
			thread.Frames[j].ClassName = s.SymbolException.Threads[i].Frames[j].ClassName
			thread.Frames[j].FileName = s.SymbolException.Threads[i].Frames[j].FileName
			thread.Frames[j].MethodName = s.SymbolException.Threads[i].Frames[j].MethodName
			thread.Frames[j].ModuleName = s.SymbolException.Threads[i].Frames[j].ModuleName
			thread.Frames[j].LineNum = s.SymbolException.Threads[i].Frames[j].LineNum
			thread.Frames[j].ColNum = s.SymbolException.Threads[i].Frames[j].ColNum
		}
	}
}

func mergeAppExitEvent(s *SymbolAppExitEvent, d *EventField) {
	d.AppExit.Trace = s.Trace
}
