# Feature - CPU Monitoring

Measure SDK captures cpu usage periodically (defaults to 3 seconds). Note that CPU usage is only
collected when the app is visible to the user.

## Event

### Event name: `cpu_usage`

| Property          | Description                                                    |
|-------------------|----------------------------------------------------------------|
| `num_cores`       | Number of cores in the device.                                 |
| `clock_speed`     | Clock speed of the device. Measured in Hz.                     |
| `uptime`          | Time since the device booted. Measured in ms.                  |
| `utime`           | Time spent executing code in user mode. Measured in Jiffies.   |
| `stime`           | Time spent executing code in kernel mode. Measured in Jiffies. |
| `cutime`          | Time spent executing code in user mode with children.          |
| `cstime`          | Time spent executing code in kernel mode with children.        |
| `interval_config` | The interval between two collections.                          |
| `start_time`      | The process start time. Measured in Jiffies.                   |

Calculated using:

* **num_cores** - Read from `Os.sysconf(_SC_NPROCESSORS_CONF)`.
* **clock_speed_hz** - Read from `Os.sysconf(_SC_CLK_TCK)`.
* **uptime** - Read from `SystemClock.elapsedRealtime()`
* **utime** - Read from `/proc/$pid/stat`.
* **stime** - Read from `/proc/$pid/stat`.
* **cutime** - Read from `/proc/$pid/stat`.
* **cstime** - Read from `/proc/$pid/stat`.
* **start_time** - Read from `/proc/$pid/stat`.
