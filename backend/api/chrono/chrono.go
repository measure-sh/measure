package chrono

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
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

// Sleep sleeps for d duration.
func Sleep(d time.Duration) {
	time.Sleep(d)
}

// JitterySleep sleeps with randomly
// added jitter. Prefer this sleep
// to avoid thundering herd problems.
func JitterySleep(d time.Duration) {
	jitter := time.Duration(rand.IntN(10)) * time.Second
	Sleep(d + jitter)
}
