# Feature - Memory Monitoring

Measure SDK captures memory usage periodically (defaults to 2 seconds) when the app is in the foreground.

## How it works

Measure SDK calculates memory usage by retrieving task-level memory information using the `task_info` API with the `TASK_VM_INFO` flavor. It extracts the `phys_footprint` value, which represents the physical memory footprint of the app in kilobytes. If the footprint value is unavailable, it falls back to using `resident_size`, which represents the resident memory size allocated to the process.

## Data collected

Check out the data collected by Measure in the [Memory Usage Absolute](../../api/sdk/README.md#memory_usage_absolute) section.
