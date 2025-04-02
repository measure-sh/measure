package sh.measure.android.performance

import android.system.OsConstants
import androidx.annotation.VisibleForTesting
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
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
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

internal const val CPU_TRACKING_INTERVAL_MS = 3000L

internal class CpuUsageCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
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
        future = try {
            defaultExecutor.scheduleAtFixedRate(
                {
                    try {
                        trackCpuUsage()
                    } catch (e: Exception) {
                        logger.log(LogLevel.Error, "Failed to track CPU usage", e)
                    }
                },
                0,
                CPU_TRACKING_INTERVAL_MS,
                TimeUnit.MILLISECONDS,
            )
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to track CPU usage", e)
            null
        }
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
        signalProcessor.track(
            type = EventType.CPU_USAGE,
            timestamp = timeProvider.now(),
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
    ): Double = prevCpuUsageData?.let { prev ->
        calculatePercentageUsage(
            utime = utime,
            stime = stime,
            cutime = cutime,
            cstime = cstime,
            uptime = uptime,
            previousCstime = prev.cstime,
            previousCutime = prev.cutime,
            previousStime = prev.stime,
            previousUtime = prev.utime,
            previousUptime = prev.uptime,
            numCores = numCores,
            clockSpeedHz = clockSpeedHz,
        )
    } ?: 0.0

    private fun readStatFile(): Array<Long>? {
        val pid = processInfo.getPid()
        val file = procProvider.getStatFile(pid)
        return if (file.exists()) {
            val stat = file.readText()
            val statArray = try {
                stat.split(" ")
            } catch (e: Exception) {
                logger.log(LogLevel.Debug, "Failed to track CPU usage: unable to parse stat file")
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
            logger.log(LogLevel.Debug, "Failed to track CPU usage: stat file does not exist")
            null
        }
    }
}
