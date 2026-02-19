# Layout Snapshot

The layout snapshot algorithm walks the Flutter element tree and produces a simplified snapshot of widgets with their screen positions.

## Tree traversal & child promotion

The element tree in Flutter is deep — most elements are invisible wrappers (themes, navigators, padding, etc.) that don't correspond to meaningful UI. The algorithm does a depth-first traversal and keeps only elements that have a `RenderBox` _and_ match the widget filter. Everything else is skipped, and its children are "promoted" up to the nearest kept ancestor.

**Example: a screen with a button**

The actual Flutter element tree:

```
MaterialApp
  └─ Theme
       └─ Navigator
            └─ Overlay
                 └─ Scaffold
                      └─ Center
                           └─ Padding
                                └─ ElevatedButton
                                     └─ Text("Click me")
```

Most of these elements either lack a render box or don't match the widget filter. The snapshot output collapses them:

```
MaterialApp
  └─ Scaffold
       └─ ElevatedButton
            └─ Text("Click me")
```

The rule: if an element doesn't have a valid render box, or doesn't match the widget filter, it is skipped and its children are promoted to the parent. Elements that are invisible (offstage, zero opacity, excluded semantics) are dropped entirely along with their subtree.

## Route filtering

When a new dialog or bottom sheet opens, the widgets behind it are no longer relevant. The algorithm uses Flutter's `BlockSemantics` signal to detect this.

**Example: a dialog opens on top of a home screen**

The Overlay's children before filtering:

```
Overlay
  ├─ Entry 0: HomeScreen (Scaffold → Button "Home")
  ├─ Entry 1: ModalBarrier (BlockSemantics, blocking = true)
  └─ Entry 2: AlertDialog (Scaffold → Button "OK")
```

When processing the Overlay's children left to right, the algorithm encounters the modal barrier with `blocking = true`. This clears all previously collected siblings — the home screen's widgets are discarded. The result:

```
AlertDialog
  └─ Button "OK"
```

Only the topmost route's widgets appear in the snapshot.

## Gesture detection

During traversal, each element's global bounds are computed and hit-tested against a position. The deepest interactive widget that contains the tap point is marked as the gesture target in the snapshot output.
