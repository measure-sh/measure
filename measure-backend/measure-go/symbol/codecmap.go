package symbol

import (
	"measure-backend/measure-go/event"

	"github.com/google/uuid"
)

type LutVal struct {
	EventIndex           int
	ExceptionIndex       int
	ThreadIndex          int
	Type                 string
	SwapExceptionType    bool
	SwapFrames           bool
	SwapTrace            bool
	SwapClassName        bool
	SwapParentActivity   bool
	SwapLaunchedActivity bool
}

// type CodecMap map[uuid.UUID]CodecMapVal

type Lut map[uuid.UUID]LutVal

func NewLutVal() *LutVal {
	return &LutVal{
		EventIndex:     -1,
		ExceptionIndex: -1,
		ThreadIndex:    -1,
	}
}

// NewExceptionLutVal creates a new lookup table
// defined for symbolicating exceptions.
func NewExceptionLutVal() LutVal {
	return LutVal{
		EventIndex:     -1,
		ExceptionIndex: -1,
		ThreadIndex:    -1,
		Type:           event.TypeException,
	}
}

// NewANRLutVal creates a new lookup table
// defined for symbolicating ANRs.
func NewANRLutVal() LutVal {
	return LutVal{
		EventIndex:     -1,
		ExceptionIndex: -1,
		ThreadIndex:    -1,
		Type:           event.TypeANR,
	}
}

// NewAppExitLutVal creates a new lookup table
// defined for symbolicating app exits.
func NewAppExitLutVal() LutVal {
	return LutVal{
		EventIndex:     -1,
		ExceptionIndex: -1,
		ThreadIndex:    -1,
		Type:           event.TypeAppExit,
	}
}

// NewLifecycleActivityLutVal creates a new lookup table
// defined for symbolicating lifecycle activities.
func NewLifecycleActivityLutVal() LutVal {
	return LutVal{
		EventIndex:     -1,
		ExceptionIndex: -1,
		ThreadIndex:    -1,
		Type:           event.TypeLifecycleActivity,
	}
}

// NewLifecycleFragmentLutVal creates a new lookup table
// defined for symbolicating lifecycle fragments.
func NewLifecycleFragmentLutVal() LutVal {
	return LutVal{
		EventIndex:     -1,
		ExceptionIndex: -1,
		ThreadIndex:    -1,
		Type:           event.TypeLifecycleFragment,
	}
}

// NewColdLaunchLutVal creates a new lookup table
// defined for symbolicating cold launches.
func NewColdLaunchLutVal() LutVal {
	return LutVal{
		EventIndex:     -1,
		ExceptionIndex: -1,
		ThreadIndex:    -1,
		Type:           event.TypeColdLaunch,
	}
}

// NewWarmLaunchLutVal creates a new lookup table
// defined for symbolicating warm launches.
func NewWarmLaunchLutVal() LutVal {
	return LutVal{
		EventIndex:     -1,
		ExceptionIndex: -1,
		ThreadIndex:    -1,
		Type:           event.TypeWarmLaunch,
	}
}

// NewHotLaunchLutVal creates a new lookup table
// defined for symbolicating hot launches.
func NewHotLaunchLutVal() LutVal {
	return LutVal{
		EventIndex:     -1,
		ExceptionIndex: -1,
		ThreadIndex:    -1,
		Type:           event.TypeHotLaunch,
	}
}

// HasException returns true if the lookup table
// contains a valid index for exception.
func (lut LutVal) HasException() bool {
	return lut.ExceptionIndex > -1
}

// HasThread returns true if the lookup table
// contains a valid index for thread.
func (lut LutVal) HasThread() bool {
	return lut.ThreadIndex > -1
}

// HasEvent returns true if the lookup table
// contains a valid index for event.
func (lut LutVal) HasEvent() bool {
	return lut.EventIndex > -1
}
