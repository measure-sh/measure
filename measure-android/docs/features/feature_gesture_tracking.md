# Feature - Gesture Tracking

Measure SDK captures gestures like click, long click and scroll events.

### Event

Event name: `gesture_click`.

The following properties are captured for each click event:

| Property        | Description                                                                                                   |
|-----------------|---------------------------------------------------------------------------------------------------------------|
| target          | Generally the class/instance name of the view on which the gesture occurred.                                  |
| target_id       | The id of the view that consumed the click gesture. For compose it's the value of the `testTag` if specified. |
| touch_down_time | Uptime when the touch down motion event occurred                                                              |
| touch_up_time   | Uptime when the touch up motion event occurred                                                                |
| width           | Width of the target view in pixels, if available.                                                             |
| height          | Height of the target view in pixels, if available.                                                            |
| x               | X coordinate of the click.                                                                                    |
| y               | Y coordinate of the click.                                                                                    |

Event name: `gesture_long_click`.

The following properties are captured for each click event:

| Property        | Description                                                                                                   |
|-----------------|---------------------------------------------------------------------------------------------------------------|
| target          | Generally the class/instance name of the view on which the gesture occurred.                                  |
| target_id       | The id of the view that consumed the click gesture. For compose it's the value of the `testTag` if specified. |
| touch_down_time | Uptime when the touch down motion event occurred                                                              |
| touch_up_time   | Uptime when the touch up motion event occurred                                                                |
| width           | Width of the target view in pixels, if available.                                                             |
| height          | Height of the target view in pixels, if available.                                                            |
| x               | X coordinate of the click.                                                                                    |
| y               | Y coordinate of the click.                                                                                    |

Event name: `gesture_scroll`.

The following properties are captured for each scroll event:

| Property        | Description                                                                                                   |
|-----------------|---------------------------------------------------------------------------------------------------------------|
| target          | Generally the class/instance name of the view on which the gesture occurred.                                  |
| target_id       | The id of the view that consumed the click gesture. For compose it's the value of the `testTag` if specified. |
| touch_down_time | Uptime when the touch down motion event occurred                                                              |
| touch_up_time   | Uptime when the touch up motion event occurred                                                                |
| x               | X coordinate of where the gesture started.                                                                    |
| y               | Y coordinate of where the gesture started.                                                                    |
| end_x           | X coordinate of where the gesture ended.                                                                      |
| end_y           | Y coordinate of where the gesture ended.                                                                      |
| direction       | The direction of the scroll, one of: up, down, left, right.                                                   |
