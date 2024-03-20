# Feature - Memory Monitoring

Measure SDK captures the following to help monitor memory:

1. [Memory usage over time](#memory-usage-over-time)
2. [Trim memory](#trim-memory)
3. [Low memory](#low-memory)

## Memory usage over time

### How it works

A worker thread reads the following properties every 2 seconds and reports them to Measure:

* **Max heap size** - collected
  using [Runtime.maxMemory](https://developer.android.com/reference/java/lang/Runtime#maxMemory()).
* **Total heap size** - collected
  using [Runtime.totalMemory](https://developer.android.com/reference/java/lang/Runtime#totalMemory()).
  using [Runtime.freeMemory](https://developer.android.com/reference/java/lang/Runtime#freeMemory()).
* **RSS (Resident set size)** - collected by reading
  the [proc/pid/statm](https://man7.org/linux/man-pages/man5/proc.5.html) file.
* **Total PSS (Proportional set size)** - collected
  using [Debug.getMemoryInfo](https://developer.android.com/reference/android/os/Debug#getMemoryInfo(android.os.Debug.MemoryInfo)).
* **Native total heap size** - collected
  using [Debug.getNativeHeapSize](https://developer.android.com/reference/android/os/Debug#getNativeHeapSize()).
* **Native free heap size** - collected
  using [Debug.getNativeFreeHeapSize](https://developer.android.com/reference/android/os/Debug#getNativeHeapFreeSize()).

### Data collected

Checkout all the data collected for memory usage in
the [Memory Usage Event](../../../docs/api/sdk/README.md#memoryusage) section.

## Trim memory

### How it works

Measure tracks
all [trim memory](https://developer.android.com/reference/android/content/ComponentCallbacks2#onTrimMemory(int))
triggered by the OS, along with the trim level. Trim memory and the level reported can provide clues about memory
availability.

### Data collected

Checkout all the data collected for trim memory in the [Trim Memory Event](../../../docs/api/sdk/README.md#trimmemory)
section.

## Low memory

### How it works

Measure tracks
all [low memory](https://developer.android.com/reference/android/content/ComponentCallbacks#onLowMemory()) events
triggered by the OS. This event can be triggered when the overall system is running low on memory,
and actively running processes should trim their memory usage.

While, this event can be triggered because of the overall memory health of the system. It is useful to track areas where
your app might be consistently running into low memory situations to optimize.

### Data collected

Checkout all the data collected for low memory in the [Low Memory Event](../../../docs/api/sdk/README.md#lowmemory)
section.


> [!NOTE]  
> Low memory event is being considered to be removed as it does not provide any additional value than trim memory event.
> The progress on this can be tracked [here](https://github.com/measure-sh/measure/issues/560).
