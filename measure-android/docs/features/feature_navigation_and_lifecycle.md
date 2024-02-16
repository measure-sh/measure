# Feature - Navigation & Lifecycle

Measure tracks the following types of navigation events in your app:

## Events

### Event name: `lifecycle_activity`

Measure tracks the lifecycle events of all activities automatically. The following properties are
collected:

| Property             | Description                                                                                    |
|----------------------|------------------------------------------------------------------------------------------------|
| type                 | The type of the lifecycle event. Possible values: `created`, `resumed`, `paused`, `destroyed`. |
| class_name           | The name of the activity class.                                                                |
| intent               | The intent used to start the activity.                                                         |
| saved_instance_state | Whether there was a saved instance state bundle for the activity, tracked only for `created`   |

### Event name: `lifecycle_fragment`

Measure tracks the lifecycle events of all androidx fragments automatically. The following
properties are collected:

| Property             | Description                                                                                    |
|----------------------|------------------------------------------------------------------------------------------------|
| type                 | The type of the lifecycle event. Possible values: `attached`, `resumed`, `paused`, `detached`. |
| class_name           | The name of the fragment class.                                                                |
| parent_activity      | The name of the parent activity that hosts the fragment.                                       |
| saved_instance_state | Whether there was a saved instance state bundle for the activity, tracked only for `created`   |
| tag                  | An optional Fragment tag, if set                                                               |

### Event name: `lifecycle_app`

Measure tracks when the app is foregrounded and backgrounded. The following properties are
collected:

| Property | Description                                                                       |
|----------|-----------------------------------------------------------------------------------|
| type     | The type of the lifecycle event. Possible values: `foregrounded`, `backgrounded`. |

### Event name: `navigation`

Measure tracks the navigation events originating from `compose-navigation's` `NavHostController`.
When using `measure-gradle-plugin` this tracking is auto added.

To manually add tracking add the`withMeasureNavigationListener` to the `NavHostController's` that
you want to track. Example:

```kotlin:
val navController = rememberNavController().withMeasureNavigationListener()
```

The following properties are collected:

| Property | Description                      |
|----------|----------------------------------|
| route    | The route that was navigated to. |