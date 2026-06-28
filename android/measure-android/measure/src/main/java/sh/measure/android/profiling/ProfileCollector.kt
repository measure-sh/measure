package sh.measure.android.profiling

import android.os.Build
import android.os.ProfilingResult
import android.os.ProfilingTrigger
import androidx.annotation.RequiresApi
import sh.measure.android.SessionManager
import sh.measure.android.events.Attachment
import sh.measure.android.events.AttachmentType
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.storage.PreviousSession
import sh.measure.android.utils.Sampler
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.TimeProvider
import java.io.File
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.function.Consumer

/**
 * Reports each trigger based profiling result from [android.os.ProfilingManager] as a
 * [EventType.PROFILE] event, attaching the output file in place at the path the platform wrote it
 * to. Requires Android 16 (API 36); [register] and [unregister] are no-ops on older versions.
 */
internal class ProfileCollector(
    private val logger: Logger,
    private val systemServiceProvider: SystemServiceProvider,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val executor: MeasureExecutorService,
    private val sampler: Sampler,
    private val prefsStorage: PrefsStorage,
    private val sessionManager: SessionManager,
) {
    private var resultCallback: Consumer<ProfilingResult>? = null

    fun register() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.BAKLAVA) {
            return
        }
        registerTriggers()
    }

    fun unregister() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.BAKLAVA) {
            return
        }
        unregisterTriggers()
    }

    @RequiresApi(Build.VERSION_CODES.BAKLAVA)
    private fun registerTriggers() {
        if (resultCallback != null) {
            return
        }
        val profilingManager = systemServiceProvider.profilingManager
        if (profilingManager == null) {
            logger.log(LogLevel.Debug, "ProfilingManager unavailable, skipping profiling")
            return
        }
        val callback = Consumer<ProfilingResult> { result -> onProfilingResult(result) }
        try {
            profilingManager.registerForAllProfilingResults(executor, callback)
            resultCallback = callback
            val triggers = triggerTypes().map { type ->
                ProfilingTrigger.Builder(type)
                    .setRateLimitingPeriodHours(RATE_LIMITING_PERIOD_HOURS)
                    .build()
            }
            profilingManager.addProfilingTriggers(triggers)
            logger.log(LogLevel.Debug, "Registered ${triggers.size} profiling triggers")
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to register profiling triggers", e)
            resultCallback = null
            runCatching { profilingManager.unregisterForAllProfilingResults(callback) }
        }
    }

    @RequiresApi(Build.VERSION_CODES.BAKLAVA)
    private fun unregisterTriggers() {
        val callback = resultCallback ?: return
        val profilingManager = systemServiceProvider.profilingManager ?: return
        try {
            profilingManager.removeProfilingTriggersByType(triggerTypes())
            profilingManager.unregisterForAllProfilingResults(callback)
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to remove profiling triggers", e)
        } finally {
            resultCallback = null
        }
    }

    @RequiresApi(Build.VERSION_CODES.BAKLAVA)
    private fun triggerTypes(): IntArray = intArrayOf(
        ProfilingTrigger.TRIGGER_TYPE_APP_FULLY_DRAWN,
        ProfilingTrigger.TRIGGER_TYPE_ANR,
    )

    @RequiresApi(Build.VERSION_CODES.BAKLAVA)
    private fun onProfilingResult(result: ProfilingResult) {
        if (result.errorCode != ProfilingResult.ERROR_NONE) {
            logger.log(
                LogLevel.Debug,
                "Profiling result error ${result.errorCode}: ${result.errorMessage}",
            )
            return
        }
        val filePath = result.resultFilePath
        if (filePath.isNullOrEmpty()) {
            return
        }
        val file = File(filePath)
        if (!file.exists()) {
            return
        }
        val format = formatFor(file.name)
        if (format == null) {
            logger.log(LogLevel.Debug, "Discarding profile with unrecognized format: ${file.name}")
            return
        }
        val reason = reasonFor(result.triggerType)
        if (reason == null) {
            logger.log(
                LogLevel.Debug,
                "Discarding profile with unrecognized trigger: ${result.triggerType}",
            )
            return
        }
        if (!sampler.shouldSampleProfile()) {
            return
        }
        val overrideSession = sessionOverrideFor(result.triggerType, file.name)
        signalProcessor.trackProfile(
            data = ProfileData(reason = reason, format = format),
            timestamp = timeProvider.now(),
            attachments = mutableListOf(
                Attachment(name = file.name, type = format, path = filePath),
            ),
            sessionId = overrideSession?.id,
            sessionStartTime = overrideSession?.startTime,
            appVersion = overrideSession?.appVersion,
            appBuild = overrideSession?.appBuild,
        )
    }

    private fun formatFor(fileName: String): String? = when {
        fileName.endsWith(PERFETTO_TRACE_EXTENSION) -> AttachmentType.PERFETTO_TRACE
        fileName.endsWith(HEAP_DUMP_EXTENSION) -> AttachmentType.HEAP_DUMP
        fileName.endsWith(HEAP_PROFILE_EXTENSION) -> AttachmentType.HEAP_PROFILE
        else -> null
    }

    private fun reasonFor(triggerType: Int): String? = when (triggerType) {
        ProfilingTrigger.TRIGGER_TYPE_APP_FULLY_DRAWN -> "app_launch"
        ProfilingTrigger.TRIGGER_TYPE_ANR -> "anr"
        else -> null
    }

    /**
     * The earlier session to attribute a profile to, or null to use the current session.
     *
     * An ANR from a dead process is delivered on a later launch and belongs to the previous session
     * when captured before the current one started. Capture time comes from the file name, not
     * [File.lastModified] (which is the delivery time).
     */
    @RequiresApi(Build.VERSION_CODES.BAKLAVA)
    private fun sessionOverrideFor(triggerType: Int, fileName: String): PreviousSession? {
        if (triggerType != ProfilingTrigger.TRIGGER_TYPE_ANR) {
            return null
        }
        val capturedAt = captureTimeFromFileName(fileName) ?: return null
        if (capturedAt >= sessionManager.getSessionStartTime()) {
            return null
        }
        return prefsStorage.getPreviousSession()
    }

    /**
     * Capture time (epoch millis) from the trailing local-time stamp in a profiling file name,
     * e.g. "profile_trigger-type-2_2026-07-01-19-59-14.perfetto-trace". Null if it doesn't match.
     */
    private fun captureTimeFromFileName(fileName: String): Long? {
        val stamp = fileName.substringAfterLast('_', "").substringBefore('.')
        if (stamp.isEmpty()) {
            return null
        }
        return try {
            SimpleDateFormat(FILE_NAME_TIMESTAMP_FORMAT, Locale.US).parse(stamp)?.time
        } catch (e: ParseException) {
            logger.log(LogLevel.Debug, "Unable to parse profile capture time from $fileName", e)
            null
        }
    }

    companion object {
        private const val RATE_LIMITING_PERIOD_HOURS = 1
        private const val FILE_NAME_TIMESTAMP_FORMAT = "yyyy-MM-dd-HH-mm-ss"
        private const val PERFETTO_TRACE_EXTENSION = ".perfetto-trace"
        private const val HEAP_DUMP_EXTENSION = ".hprof"
        private const val HEAP_PROFILE_EXTENSION = ".heapprofd"
    }
}
