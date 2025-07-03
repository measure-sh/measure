# CPU Monitoring

- [**Introduction**](#introduction)
- [**Android**](#android)
- [**iOS**](#ios)
- [**Flutter**](#flutter)
- [**Data collected**](#data-collected)

Measure SDK captures CPU usage periodically (defaults to 3 seconds) when the app is in foreground.

## Android

To calculate the CPU usage, two sets of information are required:

1. The CPU specification: The number of cores and the maximum frequency of each core. Number of cores are read from
   `Os.sysconf(OsConstants._SC_NPROCESSORS_CONF)` and the maximum frequency is read
   from `Os.sysconf(OsConstants._SC_CLK_TCK)`.
2. CPU time: The time spent by the CPU in executing instructions for an app. This information is read
   from `/proc/self/stat` file which is written to by the OS.

The [/proc/self/stat](https://man7.org/linux/man-pages/man5/proc.5.html) file contains a number of metrics out of which
we are interested only in the following:

1. utime - Amount of time that this process has been scheduled in user mode (this is where most of the application code
   runs), measured in clock ticks.
2. stime - Amount of time that this process has been scheduled in kernel mode (this is where most system processes run),
   measured in clock ticks.
3. cutime - Amount of time that this process's waited-for children have been scheduled in user mode, measured in clock
   ticks.
4. cstime - Amount of time that this process's waited-for children have been scheduled in kernel mode, measured in clock
   ticks.

The average %CPU usage by the application in a given interval is calculated using:

$\frac{{(utime - prev.utime) + (stime - prev.stime) + (cutime - prev.cutime) + (cstime - prev.cstime)}}{{clock\ speed \times interval \times number\ of\ cores}}$

Where:
* `prev.utime`, `prev.stime`, `prev.cutime`, `prev.cstime` are values from the previous event collected.
* `interval` is the time between two consecutive `cpu_usage` events.

## iOS

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

## Flutter

CPU usage is collected for Flutter apps based on the platform the app is running on (Android or iOS). The SDK uses the
same methods as described above for Android and iOS.

#### Further reading

* [Task Info](https://web.mit.edu/darwin/src/modules/xnu/osfmk/man/task_info.html)
* [Thread Info](https://web.mit.edu/darwin/src/modules/xnu/osfmk/man/thread_info.html)
* [Thread Basic Info](https://web.mit.edu/darwin/src/modules/xnu/osfmk/man/thread_basic_info.html)

## Data collected

Checkout the data collected by Measure in [CPU Usage Event](../api/sdk/README.md#cpuusage) section.