# Feature - CPU Monitoring

Measure SDK captures CPU usage periodically (default: every 3 seconds) while the app is in the foreground.

## How it works

Measure SDK calculates CPU usage by retrieving task and thread information using macOS/iOS system APIs. It performs the following steps:

- Retrieve Task-Level CPU Usage:
  - Uses task_info with `TASK_BASIC_INFO` to get overall CPU time for the process.
  - This provides details such as total user time, system time, and memory usage.

- Retrieve Thread-Level CPU Usage:
  - Uses task_threads to obtain a list of active threads within the process.
  - Iterates through each thread and calls `thread_info` with `THREAD_BASIC_INFO`.
  - Extracts per-thread CPU usage statistics and aggregates them.

- Calculate CPU Usage Percentage:
  - Each thread's CPU usage (cpu_usage field) is a fraction of `TH_USAGE_SCALE` (100% CPU time).
  - The SDK converts this into a percentage by summing the CPU usage of all non-idle threads and normalizing it against `TH_USAGE_SCALE`.

This provides an estimate of how much CPU time the app is consuming relative to available CPU resources.

## Data collected

Check out the data collected by Measure in the [CPU Usage Event](../../api/sdk/README.md#cpu_usage) section.

## Further reading

* [Task Info](https://web.mit.edu/darwin/src/modules/xnu/osfmk/man/task_info.html)
* [Thread Info](https://web.mit.edu/darwin/src/modules/xnu/osfmk/man/thread_info.html)
* [Thread Basic Info](https://web.mit.edu/darwin/src/modules/xnu/osfmk/man/thread_basic_info.html)