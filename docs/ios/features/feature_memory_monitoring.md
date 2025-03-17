# Feature - Memory Monitoring

Measure SDK periodically captures memory usage (default: every 2 seconds) while the app is in the foreground.

## How It Works

Measure SDK calculates memory usage using the `task_info` API with the `TASK_VM_INFO` flavor. This API provides detailed memory statistics for the app’s process. The SDK extracts the `phys_footprint` value, which represents the physical memory footprint of the app in kilobytes. This value accounts for real memory pages in use, shared memory overhead and compressed memory, making it an accurate measure of the app’s actual memory consumption.

If `phys_footprint` is unavailable, the SDK falls back to `resident_size`, which represents the resident memory size allocated to the process. However, `resident_size` does not reflect memory compression or pressure, so it may underreport actual memory usage compared to `phys_footprint`.

SDK falls back to `resident_size` in below cases:

- If `phys_footprint` is zero or not available due to system constraints.
- If the `task_info` API call fails (rare, but possible due to system restrictions or sandboxing).

## Impact on Dashboard Metrics

When `phys_footprint` is available, the reported memory usage reflects actual memory pressure.

When `resident_size` is used, the reported value may be lower than real usage since it excludes compressed memory.

The dashboard does not currently indicate when the SDK falls back to `resident_size`, but unusually low memory usage readings may suggest this fallback occurred.

## Data collected

Check out the data collected by Measure in the [Memory Usage Absolute](../../api/sdk/README.md#memory_usage_absolute) section.

## Further reading

* [Task Info](https://web.mit.edu/darwin/src/modules/xnu/osfmk/man/task_info.html)
* [iOS Memory Deep Dive](https://developer.apple.com/videos/play/wwdc2018/416/)
* [Apple Developer Forum Thread](https://developer.apple.com/forums/thread/105088)