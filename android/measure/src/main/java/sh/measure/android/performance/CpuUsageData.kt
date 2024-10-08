package sh.measure.android.performance

import kotlinx.serialization.Serializable

@Serializable
internal data class CpuUsageData(
    /**
     * Number of active cores in the device.
     */
    val num_cores: Int,
    /**
     * Clock speed of the device.
     */
    val clock_speed: Long,
    /**
     * Time since the device booted including device sleep. Measured in ms.
     */
    val start_time: Long,
    /**
     * Time since the device booted including sleep. Measured in ms.
     */
    val uptime: Long,
    /**
     *  Time spent executing code in user mode. Measured in Jiffies.
     */
    val utime: Long,
    /**
     * Time spent executing code for child processes in user mode. Measured in Jiffies.
     */
    val cutime: Long,
    /**
     * Time spent executing code for child processes in kernel mode. Measured in Jiffies.
     */
    val cstime: Long,
    /**
     *  Time spent executing code in kernel mode. Measured in Jiffies.
     */
    val stime: Long,
    /**
     * The interval between two collections.
     */
    val interval: Long,
    /**
     * Average %CPU usage in the interval set by [interval].
     */
    val percentage_usage: Double,
)
