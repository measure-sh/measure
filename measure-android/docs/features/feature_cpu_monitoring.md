# Feature - CPU Monitoring

Measure SDK captures CPU usage periodically (defaults to 3 seconds) when the app is in foreground.

## How it works

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

The total time spent by the application in a given interval is calculated using:

$\frac{{utime + stime + cutime + cstime}}{{clock\ speed \times interval \times number\ of\ cores}}$

## Data collected

Checkout the data collected by Measure each time the `proc/self/stat` file is read in
the [CPU Usage](../../../docs/api/sdk/README.md#cpuusage) section.