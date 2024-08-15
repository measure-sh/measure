package chrono

import (
	"encoding/json"
	"fmt"
	"time"
)

const ISOFormatJS = "2006-01-02T15:04:05.999Z"

// NanoTimeFormat is the format of datetime in nanoseconds when
// converting datetime values before inserting into database
const NanoTimeFormat = "2006-01-02 15:04:05.999999999"

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
