# Feature - Gesture Tracking

Measure SDK captures gestures like click, long click and scroll events automatically.

## How it works

When Measure SDK is initialized, it registers a touch event interceptor using
the [Curtains library](https://github.com/square/curtains?tab=readme-ov-file#curtainskt). It allows Measure to
intercept every touch event in an application and process it.

There are two main parts to tracking gestures:

1. [Gesture detection](#gesture-detection)
2. [Gesture target detection](#gesture-target-detection)

> [!WARNING]  
> Gesture detection and gesture target detection work on best-effort basis, and can report a view group containing
> the interacted view instead of the view itself.

### Gesture detection

Measure tracks the time between `ACTION_DOWN` and `ACTION_UP` events and the distance moved to classify a touch as
click, long click or scroll.

A gesture is classified as a long click gesture if the time interval between `ACTION_DOWN` and `ACTION_UP` is more
than [ViewConfiguration.getLongPressTimeout](https://developer.android.com/reference/android/view/ViewConfiguration#getLongPressTimeout())
time and the distance moved by the pointer between the two events is
less
than [ViewConfiguration.get.getScaledTouchSlop](https://developer.android.com/reference/android/view/ViewConfiguration#getScaledTouchSlop()).

A gesture is classified as a click if the distance moved by the pointer between the two events is
less
than [ViewConfiguration.get.getScaledTouchSlop](https://developer.android.com/reference/android/view/ViewConfiguration#getScaledTouchSlop())
but the time interval between the two events is less
than [ViewConfiguration.getLongPressTimeout()](https://developer.android.com/reference/android/view/ViewConfiguration#getLongPressTimeout()).

A gesture is classified as a scroll if the distance moved by the pointer between the two events is more than
[ViewConfiguration.get.scaledTouchSlop](https://developer.android.com/reference/android/view/ViewConfiguration#getScaledTouchSlop()).
An estimation of direction in which the scroll happened based on the pointer movement.

**For compose**, a click/long click is detected by traversing the semantics tree
using [SemanticsOwner.getAllSemanticsNodes](https://developer.android.com/reference/kotlin/androidx/compose/ui/semantics/SemanticsOwner#(androidx.compose.ui.semantics.SemanticsOwner).getAllSemanticsNodes(kotlin.Boolean,kotlin.Boolean))
and finding a composable at the point where the touch happened and checking for Semantics Properties -
SemanticsActions.OnClick, SemanticsActions.OnLongClick and SemanticsActions.ScrollBy
for click, long click and scroll respectively.

### Gesture target detection

Along with the type of gesture which occurred, Measure can also **estimate** the target view/composable on which the
gesture was performed on.

For a click/long click, a hit test is performed to check the views which are under the point where the touch occurred. A
traversal is performed on the children of the view group found and is checked for any view which has
either [isClickable](https://developer.android.com/reference/android/view/View#isClickable())
or [isPressed](https://developer.android.com/reference/android/view/View#isPressed()) set to true. If one is found, it
is returned as the target, otherwise, the touch is discarded as can be classified as a "dead click".

Similarly, for a scroll, after the hit test, a traversal is performed for any view which
has [isScrollContainer](https://developer.android.com/reference/android/view/View#isScrollContainer()) set to
true and [canScrollVertically](https://developer.android.com/reference/android/view/View#canScrollVertically(int))
or [canScrollHorizontally](https://developer.android.com/reference/android/view/View#canScrollHorizontally(int)). If a
view which satisfies this condition it is returned as the target, otherwise, the scroll is discarded and can be
classified as a "dead scroll".

#### Benchmark results
Checkout the results from a macro benchmark we ran for gesture target
detection [here](https://github.com/measure-sh/measure/pull/377#issue-2123559330).
TLDR;

* On average, it takes 0.458 ms to find the clicked view in a deep view hierarchy.
* On average, it takes 0.658 ms to find the clicked composable in a deep composable hierarchy.

> [!NOTE]  
> Compose currently reports the target_id in the collected data
>
using [testTag](https://developer.android.com/reference/kotlin/androidx/compose/ui/semantics/package-summary#(androidx.compose.ui.semantics.SemanticsPropertyReceiver).testTag()),
> if it is set. While the `target` is always reported as `AndroidComposeView`. This will be improved in the future, the
> progress can be tracked [here]().
