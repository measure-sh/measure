package symbol

import (
	"backend/api/event"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

const (
	// TypeUnknown represents an unknown
	// type of mapping symbolication.
	TypeUnknown MappingType = iota
	// TypeProguard represents the "proguard"
	// type of mapping symbolication.
	TypeProguard
	// TypeDsym represents the "dSYM"
	// type of mapping symbolication.
	TypeDsym
)

// MappingType represents the mapping
// type for internal computational use.
type MappingType int

// String provides the human recognizable
// mapping type.
func (m MappingType) String() string {
	switch m {
	default:
		return "unknown"
	case TypeProguard:
		return "proguard"
	case TypeDsym:
		return "dsym"
	}
}

// Symboler describes the interface for symbolication.
type Symboler interface {
	Batch(events []event.EventField) (batches []SymbolBatch)
	Symbolicate(ctx context.Context, batch SymbolBatch) (err error)
}

// MappingKeyID represents the constituents parts
// of a mapping key id.
type MappingKeyID struct {
	appId       uuid.UUID
	versionName string
	versionCode string
	mappingType string
}

// SymbolBatch represents a batch of events
// to symbolicate.
type SymbolBatch struct {
	// mappingKeyID is the mapping key id.
	mappingKeyID MappingKeyID

	// Events are all the events in this batch.
	Events []event.EventField

	// lut is a map to cache all the lookup
	// tables.
	lut map[uuid.UUID]LutVal

	// frags is the list of symbolication
	// fragments.
	frags []Fragment

	// Errs are all the errors that happened
	// during symbolication.
	Errs []error
}

// Symbolicator offers symbolication of a batch
// of events.
type Symbolicator struct {
	opts *Options
}

// Options represents the configuration options
// for configuing the Symbolicator.
type Options struct {
	// Origin is the origin of the symbolicator service.
	Origin string

	// Store is the connection to the backing store
	// to fetch mapping keys.
	Store *pgxpool.Pool

	// Table is the name of the table storing build
	// mappings.
	Table string
}

// NewSymbolicator creates a new instance of Symbolicator.
func NewSymbolicator(opts *Options) (symbolicator *Symbolicator, err error) {
	if opts.Origin == "" {
		err = fmt.Errorf(`%q must not be empty`, `Origin`)
		return
	}
	if opts.Store == nil {
		err = fmt.Errorf(`%q must not be nil`, `Store`)
		return
	}
	if opts.Table == "" {
		opts.Table = `public.build_mappings`
	}
	symbolicator = &Symbolicator{
		opts: opts,
	}
	return
}

// Batch creates groups of events based on the event's attribute
// values.
func (s Symbolicator) Batch(events []event.EventField) (batches []SymbolBatch) {
	keys := make(map[string]SymbolBatch)

	for i := range events {
		key := MappingKeyID{
			appId:       events[i].AppID,
			versionName: events[i].Attribute.AppVersion,
			versionCode: events[i].Attribute.AppBuild,
			mappingType: TypeProguard.String(),
		}

		batch, exists := keys[key.String()]

		if exists {
			batch.add(events[i])
		} else {
			batch.mappingKeyID = key
			batch.add(events[i])
		}
		keys[key.String()] = batch
	}

	sortedKeys := []string{}

	for key := range keys {
		sortedKeys = append(sortedKeys, key)
	}

	// since go's map keys are unordered
	slices.Sort(sortedKeys)

	for _, key := range sortedKeys {
		batches = append(batches, keys[key])
	}

	return
}

// GetKey fetches the mapping key from the backing store.
func (s Symbolicator) GetKey(ctx context.Context, batch SymbolBatch) (key string, err error) {
	store := s.opts.Store
	table := s.opts.Table

	stmt := sqlf.PostgreSQL.
		Select("key").
		From(table).
		Where("app_id = ?", batch.mappingKeyID.appId).
		Where("version_name = ?", batch.mappingKeyID.versionName).
		Where("version_code = ?", batch.mappingKeyID.versionCode).
		Where("mapping_type = ?", batch.mappingKeyID.mappingType)

	defer stmt.Close()

	if err := store.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&key); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}

	return
}

// Symbolicate symbolicates the symbolication batch and saves the errors
// in the batch if any.
func (s Symbolicator) Symbolicate(ctx context.Context, batch SymbolBatch) error {
	key, err := s.GetKey(ctx, batch)

	if err != nil {
		return err
	}

	// in case no mapping file is found, just log and proceed
	if key == "" {
		fmt.Println("no mapping file found for event batch")
		return nil
	}

	batch.encode()

	if !batch.hasFrags() {
		return errors.New(`failed to symbolicate, batch does not contain any symbolication fragments`)
	}

	type SymReq struct {
		Key   string     `json:"key"`
		Frags []Fragment `json:"data"`
	}

	url := s.opts.Origin + "/symbolicate"
	payload, err := json.Marshal(SymReq{
		Key:   key,
		Frags: batch.frags,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf(`symbolication request failed with status %d`, resp.StatusCode)
	}

	var frags []Fragment
	if err := json.NewDecoder(resp.Body).Decode(&frags); err != nil {
		return err
	}

	batch.decode(frags)

	return nil
}

// Add adds an event to the batch.
func (b *SymbolBatch) add(event event.EventField) {
	b.Events = append(b.Events, event)
}

// encode encodes the batch for symbolication.
func (b *SymbolBatch) encode() {
	if b.lut == nil {
		b.lut = make(map[uuid.UUID]LutVal)
	}

	for evtIdx, evt := range b.Events {
		if evt.IsException() {
			for excIdx, exc := range evt.Exception.Exceptions {
				if len(exc.Frames) > 0 {
					lut := NewExceptionLutVal()
					lut.SwapFrames = true
					lut.EventIndex = evtIdx
					lut.ExceptionIndex = excIdx
					frag := NewFragment()
					b.lut[frag.ID] = lut
					for i := range exc.Frames {
						frag.Values = append(frag.Values, MarshalRetraceFrame(exc.Frames[i], event.FramePrefix))
					}
					b.frags = append(b.frags, frag)
				}
				if len(exc.Type) > 0 {
					lut := NewExceptionLutVal()
					lut.SwapExceptionType = true
					lut.EventIndex = evtIdx
					lut.ExceptionIndex = excIdx
					frag := NewFragment()
					b.lut[frag.ID] = lut
					frag.Values = []string{event.GenericPrefix + exc.Type}
					b.frags = append(b.frags, frag)
				}
			}

			for thrdIdx, thrd := range evt.Exception.Threads {
				if len(thrd.Frames) > 0 {
					lut := NewExceptionLutVal()
					lut.SwapFrames = true
					lut.EventIndex = evtIdx
					lut.ThreadIndex = thrdIdx
					frag := NewFragment()
					b.lut[frag.ID] = lut
					for i := range thrd.Frames {
						frag.Values = append(frag.Values, MarshalRetraceFrame(thrd.Frames[i], event.FramePrefix))
					}
					b.frags = append(b.frags, frag)
				}
			}
		}

		if evt.IsANR() {
			for excIdx, exc := range evt.ANR.Exceptions {
				if len(exc.Frames) > 0 {
					lut := NewANRLutVal()
					lut.SwapFrames = true
					lut.EventIndex = evtIdx
					lut.ExceptionIndex = excIdx
					frag := NewFragment()
					b.lut[frag.ID] = lut
					for i := range exc.Frames {
						frag.Values = append(frag.Values, MarshalRetraceFrame(exc.Frames[i], event.FramePrefix))
					}
					b.frags = append(b.frags, frag)
				}
				if len(exc.Type) > 0 {
					lut := NewANRLutVal()
					lut.SwapExceptionType = true
					lut.EventIndex = evtIdx
					lut.ExceptionIndex = excIdx
					frag := NewFragment()
					b.lut[frag.ID] = lut
					frag.Values = []string{event.GenericPrefix + exc.Type}
					b.frags = append(b.frags, frag)
				}
			}

			for thrdIdx, thrd := range evt.ANR.Threads {
				if len(thrd.Frames) > 0 {
					lut := NewANRLutVal()
					lut.SwapFrames = true
					lut.EventIndex = evtIdx
					lut.ThreadIndex = thrdIdx
					frag := NewFragment()
					b.lut[frag.ID] = lut
					for i := range thrd.Frames {
						frag.Values = append(frag.Values, MarshalRetraceFrame(thrd.Frames[i], event.FramePrefix))
					}
					b.frags = append(b.frags, frag)
				}
			}
		}

		if evt.IsAppExit() {
			if len(evt.AppExit.Trace) > 0 {
				lut := NewAppExitLutVal()
				lut.SwapTrace = true
				lut.EventIndex = evtIdx
				frag := NewFragment()
				b.lut[frag.ID] = lut
				frag.Values = []string{event.GenericPrefix + evt.AppExit.Trace}
				b.frags = append(b.frags, frag)
			}
		}

		if evt.IsLifecycleActivity() {
			if len(evt.LifecycleActivity.ClassName) > 0 {
				lut := NewLifecycleActivityLutVal()
				lut.SwapClassName = true
				lut.EventIndex = evtIdx
				frag := NewFragment()
				b.lut[frag.ID] = lut
				frag.Values = []string{event.GenericPrefix + evt.LifecycleActivity.ClassName}
				b.frags = append(b.frags, frag)
			}
		}

		if evt.IsLifecycleFragment() {
			if len(evt.LifecycleFragment.ClassName) > 0 {
				lut := NewLifecycleFragmentLutVal()
				lut.SwapClassName = true
				lut.EventIndex = evtIdx
				frag := NewFragment()
				b.lut[frag.ID] = lut
				frag.Values = []string{event.GenericPrefix + evt.LifecycleFragment.ClassName}
				b.frags = append(b.frags, frag)
			}
			if len(evt.LifecycleFragment.ParentActivity) > 0 {
				lut := NewLifecycleFragmentLutVal()
				lut.SwapParentActivity = true
				lut.EventIndex = evtIdx
				frag := NewFragment()
				b.lut[frag.ID] = lut
				frag.Values = []string{event.GenericPrefix + evt.LifecycleFragment.ParentActivity}
				b.frags = append(b.frags, frag)
			}
			if len(evt.LifecycleFragment.ParentFragment) > 0 {
				lut := NewLifecycleFragmentLutVal()
				lut.SwapParentFragment = true
				lut.EventIndex = evtIdx
				frag := NewFragment()
				b.lut[frag.ID] = lut
				frag.Values = []string{event.GenericPrefix + evt.LifecycleFragment.ParentFragment}
				b.frags = append(b.frags, frag)
			}
		}

		if evt.IsColdLaunch() {
			if len(evt.ColdLaunch.LaunchedActivity) > 0 {
				lut := NewColdLaunchLutVal()
				lut.SwapLaunchedActivity = true
				lut.EventIndex = evtIdx
				frag := NewFragment()
				b.lut[frag.ID] = lut
				frag.Values = []string{event.GenericPrefix + evt.ColdLaunch.LaunchedActivity}
				b.frags = append(b.frags, frag)
			}
		}

		if evt.IsWarmLaunch() {
			if len(evt.WarmLaunch.LaunchedActivity) > 0 {
				lut := NewWarmLaunchLutVal()
				lut.SwapLaunchedActivity = true
				lut.EventIndex = evtIdx
				frag := NewFragment()
				b.lut[frag.ID] = lut
				frag.Values = []string{event.GenericPrefix + evt.WarmLaunch.LaunchedActivity}
				b.frags = append(b.frags, frag)
			}
		}

		if evt.IsHotLaunch() {
			if len(evt.HotLaunch.LaunchedActivity) > 0 {
				lut := NewHotLaunchLutVal()
				lut.SwapLaunchedActivity = true
				lut.EventIndex = evtIdx
				frag := NewFragment()
				b.lut[frag.ID] = lut
				frag.Values = []string{event.GenericPrefix + evt.HotLaunch.LaunchedActivity}
				b.frags = append(b.frags, frag)
			}
		}
	}
}

// decode decodes the symbolicated fragments and updates
// the batch's events with the symbolicated events.
func (b *SymbolBatch) decode(frags []Fragment) {
	b.frags = frags
	var errs []error

	for _, frag := range frags {
		lut := b.lut[frag.ID]

		switch lut.Type {
		case event.TypeException:
			if lut.SwapFrames {
				if lut.HasException() {
					var frames event.Frames
					for _, value := range frag.Values {
						frame, err := UnmarshalRetraceFrame(value, event.FramePrefix)
						if err != nil {
							errs = append(errs, err)
							continue
						}
						frames = append(frames, event.Frame{
							ClassName:  frame.ClassName,
							LineNum:    frame.LineNum,
							FileName:   frame.FileName,
							MethodName: frame.MethodName,
						})
					}
					b.Events[lut.EventIndex].Exception.Exceptions[lut.ExceptionIndex].Frames = frames
				}

				if lut.HasThread() {
					var frames event.Frames
					for _, value := range frag.Values {
						frame, err := UnmarshalRetraceFrame(value, event.FramePrefix)
						if err != nil {
							errs = append(errs, err)
							continue
						}
						frames = append(frames, event.Frame{
							ClassName:  frame.ClassName,
							LineNum:    frame.LineNum,
							FileName:   frame.FileName,
							MethodName: frame.MethodName,
						})
						b.Events[lut.EventIndex].Exception.Threads[lut.ThreadIndex].Frames = frames
					}
				}
			}

			if lut.SwapExceptionType {
				b.Events[lut.EventIndex].Exception.Exceptions[lut.ExceptionIndex].Type = strings.TrimPrefix(frag.Values[0], event.GenericPrefix)
			}
		case event.TypeANR:
			if lut.SwapFrames {
				if lut.HasException() {
					var frames event.Frames
					for _, value := range frag.Values {
						frame, err := UnmarshalRetraceFrame(value, event.FramePrefix)
						if err != nil {
							errs = append(errs, err)
							continue
						}
						frames = append(frames, event.Frame{
							ClassName:  frame.ClassName,
							LineNum:    frame.LineNum,
							FileName:   frame.FileName,
							MethodName: frame.MethodName,
						})
					}
					b.Events[lut.EventIndex].ANR.Exceptions[lut.ExceptionIndex].Frames = frames
				}

				if lut.HasThread() {
					var frames event.Frames
					for _, value := range frag.Values {
						frame, err := UnmarshalRetraceFrame(value, event.FramePrefix)
						if err != nil {
							errs = append(errs, err)
							continue
						}
						frames = append(frames, event.Frame{
							ClassName:  frame.ClassName,
							LineNum:    frame.LineNum,
							FileName:   frame.FileName,
							MethodName: frame.MethodName,
						})
					}
					b.Events[lut.EventIndex].ANR.Threads[lut.ThreadIndex].Frames = frames
				}
			}

			if lut.SwapExceptionType {
				b.Events[lut.EventIndex].ANR.Exceptions[lut.ExceptionIndex].Type = strings.TrimPrefix(frag.Values[0], event.GenericPrefix)
			}
		case event.TypeAppExit:
			if lut.SwapTrace {
				b.Events[lut.EventIndex].AppExit.Trace = strings.TrimPrefix(frag.Values[0], event.GenericPrefix)
			}
		case event.TypeLifecycleActivity:
			if lut.SwapClassName {
				b.Events[lut.EventIndex].LifecycleActivity.ClassName = strings.TrimPrefix(frag.Values[0], event.GenericPrefix)
			}
		case event.TypeLifecycleFragment:
			if lut.SwapClassName {
				b.Events[lut.EventIndex].LifecycleFragment.ClassName = strings.TrimPrefix(frag.Values[0], event.GenericPrefix)
			}
			if lut.SwapParentActivity {
				b.Events[lut.EventIndex].LifecycleFragment.ParentActivity = strings.TrimPrefix(frag.Values[0], event.GenericPrefix)
			}
			if lut.SwapParentFragment {
				b.Events[lut.EventIndex].LifecycleFragment.ParentFragment = strings.TrimPrefix(frag.Values[0], event.GenericPrefix)
			}
		case event.TypeColdLaunch:
			if lut.SwapLaunchedActivity {
				b.Events[lut.EventIndex].ColdLaunch.LaunchedActivity = strings.TrimPrefix(frag.Values[0], event.GenericPrefix)
			}
		case event.TypeWarmLaunch:
			if lut.SwapLaunchedActivity {
				b.Events[lut.EventIndex].WarmLaunch.LaunchedActivity = strings.TrimPrefix(frag.Values[0], event.GenericPrefix)
			}
		case event.TypeHotLaunch:
			if lut.SwapLaunchedActivity {
				b.Events[lut.EventIndex].HotLaunch.LaunchedActivity = strings.TrimPrefix(frag.Values[0], event.GenericPrefix)
			}
		default:
			continue
		}
	}

	if len(errs) > 0 {
		b.Errs = errs
	}
}

// hasFrags returns true if the batch
// contains symbolication fragments.
func (b SymbolBatch) hasFrags() bool {
	return len(b.frags) > 0
}

// String provides a stringified representation of
// MappingKeyID.
func (m MappingKeyID) String() string {
	var b strings.Builder

	b.WriteString(m.appId.String())
	b.WriteString("/")
	b.WriteString(m.versionName)
	b.WriteString("/")
	b.WriteString(m.versionCode)
	b.WriteString("/")
	b.WriteString(m.mappingType)

	return b.String()
}
