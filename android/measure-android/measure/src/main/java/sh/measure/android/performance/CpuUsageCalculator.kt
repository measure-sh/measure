package sh.measure.android.performance

internal fun calculatePercentageUsage(
    utime: Long,
    stime: Long,
    cutime: Long,
    cstime: Long,
    uptime: Long,
    previousUtime: Long,
    previousStime: Long,
    previousCutime: Long,
    previousCstime: Long,
    previousUptime: Long,
    numCores: Int,
    clockSpeedHz: Long,
): Double {
    if (numCores <= 0) {
        // This should never happen, but just in case.
        return 0.0
    }
    val durationInSeconds = (uptime - previousUptime) / 1000
    if (durationInSeconds <= 0) {
        // This should never happen, but just in case.
        return 0.0
    }
    val total = utime + stime + cutime + cstime
    val previousTotal = previousUtime + previousStime + previousCutime + previousCstime
    val deltaTotalUsage = total - previousTotal

    val usageTimeInSeconds = deltaTotalUsage / clockSpeedHz.toDouble()
    val usageOverInterval = usageTimeInSeconds / durationInSeconds
    val averageUsagePerCore = usageOverInterval / numCores
    val percentageUsage = averageUsagePerCore * 100
    if (percentageUsage < 0) {
        // This should never happen (utime, stime, cutime, cstime are cumulative values), but
        // just in case.
        return 0.0
    }
    return percentageUsage
}
