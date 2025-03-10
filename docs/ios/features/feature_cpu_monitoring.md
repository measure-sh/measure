# Feature - CPU Monitoring

Measure SDK captures CPU usage periodically (defaults to 3 seconds) when the app is in the foreground.

## How it works

Measure SDK calculates CPU usage by retrieving task and thread information from the system. It uses `task_info` to gather overall task details and `task_threads` to obtain a list of active threads. Then, `thread_info` is used to extract CPU usage from each thread. The CPU usage of all threads is summed up and converted into a percentage of the total available CPU time.

## Data collected

Check out the data collected by Measure in the [CPU Usage Event](../../api/sdk/README.md#cpu_usage) section.
