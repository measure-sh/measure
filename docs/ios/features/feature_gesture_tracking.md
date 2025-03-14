# Feature - Gesture Tracking

Measure SDK captures gestures such as click, long click, and scroll events automatically.

## How it works

Gesture tracking consists of two main components:

1. [Gesture detection](#gesture-detection)
2. [Gesture target detection](#gesture-target-detection)

### Gesture detection

Measure SDK detects touch events by swizzling `UIWindow`'s `sendEvent` method. It processes touch events to classify them into different gesture types:

- **Click**: A touch event that lasts for less than 500 ms.
- **Long Click**: A touch event that lasts for more than 500 ms.
- **Scroll**: A touch movement exceeding 3.5 points in any direction.

### Gesture target detection

Gesture target detection identifies the UI element interacted with during a gesture. It first determines the view at the touch location and then searches its subviews to find the most relevant target. For scroll detection, it checks if the interacted element is a scrollable view like `UIScrollView`, `UIDatePicker`, or `UIPickerView`.

## Benchmark results

- On average, it takes **4 ms** to identify the clicked view in a view hierarchy with a depth of **1,500**.
- For more common scenarios, a view hierarchy with a depth of **20** takes approximately **0.2 ms**.
- You can find the benchmark tests in [GestureTargetFinderTests](../../../ios/Tests/MeasureSDKTests/Gestures/GestureTargetFinderTests.swift).

## Data collected

Check out the data collected by Measure in the [Gesture Click](../../api/sdk/README.md#gesture_click), [Gesture Long Click](../../api/sdk/README.md#gesture_long_click) and [Gesture Scroll](../../api/sdk/README.md#gesture_scroll) sections.
