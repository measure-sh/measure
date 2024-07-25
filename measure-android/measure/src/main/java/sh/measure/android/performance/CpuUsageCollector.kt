package sh.measure.android.performance

import android.system.OsConstants
import androidx.annotation.VisibleForTesting
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.OsSysConfProvider
import sh.measure.android.utils.OsSysConfProviderImpl
import sh.measure.android.utils.ProcProvider
import sh.measure.android.utils.ProcProviderImpl
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

internal const val CPU_TRACKING_INTERVAL_MS = 3000L

internal class CpuUsageCollector(
    private val logger: Logger,
    private val eventProcessor: EventProcessor,
    private val processInfo: ProcessInfoProvider,
    private val timeProvider: TimeProvider,
    private val defaultExecutor: MeasureExecutorService,
    private val procProvider: ProcProvider = ProcProviderImpl(),
    private val osSysConfProvider: OsSysConfProvider = OsSysConfProviderImpl(),
) {
    @VisibleForTesting
    var prevCpuUsageData: CpuUsageData? = null

    @VisibleForTesting
    var future: Future<*>? = null

    fun register() {
        if (!processInfo.isForegroundProcess()) return
        if (future != null) return
        future = defaultExecutor.scheduleAtFixedRate(
            {
                trackCpuUsage()
            },
            0,
            CPU_TRACKING_INTERVAL_MS,
            TimeUnit.MILLISECONDS,
        )
    }

    fun resume() {
        if (future == null) register()
    }

    fun pause() {
        future?.cancel(false)
        future = null
    }

    private fun trackCpuUsage() {
        val (utime, stime, cutime, cstime, startTime) = readStatFile() ?: return
        val numCores = osSysConfProvider.get(OsConstants._SC_NPROCESSORS_CONF).toInt()
        val clockSpeedHz = osSysConfProvider.get(OsConstants._SC_CLK_TCK)
        if (clockSpeedHz <= 0L || numCores <= 0L) return
        val uptime = timeProvider.elapsedRealtime
        val percentageCpuUsage =
            getPercentageCpuUsage(utime, stime, cutime, cstime, uptime, numCores, clockSpeedHz)
        val interval = getInterval(uptime)
        val cpuUsageData = CpuUsageData(
            num_cores = numCores,
            clock_speed = clockSpeedHz,
            uptime = uptime,
            utime = utime,
            stime = stime,
            cutime = cutime,
            cstime = cstime,
            start_time = startTime,
            interval = interval,
            percentage_usage = percentageCpuUsage,
        )
        if (prevCpuUsageData?.percentage_usage == cpuUsageData.percentage_usage) {
            // do not track the event if the usage is the same as the previous one.
            return
        }
        eventProcessor.track(
            type = EventType.CPU_USAGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = cpuUsageData,
        )
        prevCpuUsageData = cpuUsageData
    }

    private fun getInterval(uptime: Long): Long {
        return prevCpuUsageData?.let {
            (uptime - it.uptime).coerceAtLeast(0)
        } ?: 0
    }
    private fun getPercentageCpuUsage(
        utime: Long,
        stime: Long,
        cutime: Long,
        cstime: Long,
        uptime: Long,
        numCores: Int,
        clockSpeedHz: Long,
    ) = if (prevCpuUsageData == null) {
        0.0
    } else {
        calculatePercentageUsage(
            utime = utime,
            stime = stime,
            cutime = cutime,
            cstime = cstime,
            uptime = uptime,
            previousCstime = prevCpuUsageData!!.cstime,
            previousCutime = prevCpuUsageData!!.cutime,
            previousStime = prevCpuUsageData!!.stime,
            previousUtime = prevCpuUsageData!!.utime,
            previousUptime = prevCpuUsageData!!.uptime,
            numCores = numCores,
            clockSpeedHz = clockSpeedHz,
        )
    }

    private fun readStatFile(): Array<Long>? {
        val pid = processInfo.getPid()
        val file = procProvider.getStatFile(pid)
        return if (file.exists()) {
            val stat = file.readText()
            val statArray = try {
                stat.split(" ")
            } catch (e: Exception) {
                logger.log(LogLevel.Error, "Unable to parse stat file to get CPU usage")
                return null
            }
            return arrayOf(
                /* utime */
                statArray[13].toLong(),
                /* stime */
                statArray[14].toLong(),
                /* cutime */
                statArray[15].toLong(),
                /* cstime */
                statArray[16].toLong(),
                /* start_time */
                statArray[21].toLong(),
            )
        } else {
            logger.log(LogLevel.Error, "Unable to read stat file to get CPU usage")
            null
        }
    }
}
