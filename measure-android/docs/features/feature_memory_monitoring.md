# Feature - Memory Monitoring

Measure SDK provides multiple signals to monitor memory usage of your app. You can use these signals
to understand how your app is using memory and how it's memory usage changes over time. Note that
Memory usage is only collected when the app is visible to the user.

## Events

### Event name: `memory_usage`

Measure collects the following metrics at regular intervals (defaults to 1000 ms):

| Property          | Description                                                                                                                                                                  |
|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| java_max_heap     | Maximum size of the Java heap allocated to the application. Calculated using `Runtime.getRuntime().maxMemory()`. Measured in kB.                                             |
| java_total_heap   | Total size of the Java heap available for memory allocation. Calculated using `Runtime.getRuntime().totalMemory()`. Measured in kB.                                          |
| java_free_heap    | Amount of free memory available in the Java heap. Calculated using `Runtime.getRuntime().freeMemory()`. Measured in kB.                                                      |                                                              
| total_pss         | Total proportional set size - the amount of memory used by the process, including shared memory and code. Calculated using `Debug.getMemoryInfo().totalPss`. Measured in kB. |
| rss               | Resident set size of the Java process - the amount of physical memory currently used by the Java application. Calculated from `/proc/$pid/statm`. Measured in kB.            |
| native_total_heap | Total size of the native heap (memory outside of Java's control) available for memory allocation. Calculated using `Debug.getNativeHeapSize()`. Measured in kB.              |
| native_free_heap  | Amount of free memory available in the native heap. Calculated using `Debug.getNativeHeapFreeSize()`. Measured in kB.                                                        |
| interval_config   | The interval between two consecutive readings. Measured in ms. Defaults to 1000ms.                                                                                           |

### Event name: `low_memory`

This event is triggered when the system is running low on memory. Collected when `ComponentCallbacks2.onLowMemory()`
callback is triggered for the application. There are no other properties collected for this event.

### Event name: `trim_memory`

Called when the operating system determines that it is a good time for a process to trim unneeded memory from its
process.

| Property | Description                                                                                                                                                                                                                                         |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| level    | The level of trimming requested. One of the following: `TRIM_MEMORY_COMPLETE`, `TRIM_MEMORY_MODERATE`, `TRIM_MEMORY_BACKGROUND`, `TRIM_MEMORY_UI_HIDDEN`, `TRIM_MEMORY_RUNNING_CRITICAL`, `TRIM_MEMORY_RUNNING_LOW`, `TRIM_MEMORY_RUNNING_MODERATE` |

