// Package replay provides capabilities & functionalities
// for session replay.
package replay

/*
This package holds types and computational logic suited
for session replay functionality. Here's a high-level
breakdown of each.

- **cpu**: operations related to app's cpu usage
- **memory**: operations related to app's memory usage
- **network**: operations related to app's network usage
- **critical**: operations related to app's breakdown events like crashes and ANRs
- **gesture**: operations related to app's user interactive gestures like clicks and scrolls
- **log**: operations related to developer owned debug logs
- **lifecycle** - operations related to app's lifecycle events
- **navigation** - operations related to app's navigation events
- **launch** - operations related to app's start timings and events
- **exit** - operations related to app's stop timings and events

Additionally, this package also contains glue code to massage the
shape of session replay objects.

Example:

```go
import {
	"measure-backend/measure-go/event"
	"measure-backend/measure-go/replay"
	"fmt"
}

func main() {
	var clickEvents []event.EventField

	// generate 5 click events
	for i = 0; i < 5; i++ {
		click := event.EventField{
			Type: event.TypeGestureClick,
			ThreadName: "main",
			GestureClick: event.GestureClick{},
		}
		clickEvents = append(clickEvents, click)
	}

	// perform compute
	gestureClicks := replay.ComputeGestureClicks(clickEvents)

	// organize events by thread
	gcThreads := replay.GroupByThreads(gestureClicks)
	threads := make(replay.Threads)
	threads.Organize(event.TypeGestureClick, gcThreads)

	fmt.Println("threads", threads)
}
```
*/
