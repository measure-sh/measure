package symbol

import (
	"github.com/google/uuid"
)

const TransformSwap = "swap"

type CodecMapVal struct {
	Event            int
	Type             string
	ExceptionType    string
	ANR              int
	Exception        int
	Thread           int
	Frames           string
	Target           string
	Trace            string
	ClassName        string
	ParentActivity   string
	LaunchedActivity string
}

type CodecMap map[uuid.UUID]CodecMapVal

func NewCodecMapVal() *CodecMapVal {
	return &CodecMapVal{
		Event:     -1,
		ANR:       -1,
		Exception: -1,
		Thread:    -1,
	}
}
