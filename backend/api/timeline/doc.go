// Package timeline provides capabilities & functionalities
// for session timeline.
package timeline

/*
This package holds types and computational logic suited
for session timeline functionality. Here's a high-level
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
shape of session timeline objects.

Example:

```go
import {
	"backend/api/event"
	"backend/api/timeline"
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
	gestureClicks := timeline.ComputeGestureClicks(clickEvents)

	// organize events by thread
	gcThreads := timeline.GroupByThreads(gestureClicks)
	threads := make(timeline.Threads)
	threads.Organize(event.TypeGestureClick, gcThreads)

	fmt.Println("threads", threads)
}
```
*/
