package chrono

import (
	"encoding/json"
	"fmt"
	"time"
)

const ISOFormatJS = "2006-01-02T15:04:05.999Z"

type ISOTime time.Time

func (t *ISOTime) MarshalJSON() ([]byte, error) {
	time := time.Time(*t).Format(ISOFormatJS)
	return json.Marshal(time)
}

func (i *ISOTime) Scan(src interface{}) error {
	switch t := src.(type) {
	case time.Time:
		*i = ISOTime(t)
		return nil
	default:
		return fmt.Errorf("failed to convert to ISOTime type from %T", t)
	}
}
