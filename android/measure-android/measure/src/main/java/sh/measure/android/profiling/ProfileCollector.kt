package sh.measure.android.profiling

import android.os.Build
import android.os.ProfilingResult
import android.os.ProfilingTrigger
import androidx.annotation.RequiresApi
import androidx.annotation.VisibleForTesting
import sh.measure.android.SessionManager
import sh.measure.android.events.Attachment
import sh.measure.android.events.AttachmentType
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
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
 * to.
 *
 * Requires Android 16 (API 36); [register] and [unregister] are no-ops on older versions.
 */
internal class ProfileCollector(
    private val logger: Logger,
    private val systemServiceProvider: SystemServiceProvider,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val ioExecutor: MeasureExecutorService,
    private val sampler: Sampler,
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
            profilingManager.registerForAllProfilingResults(ioExecutor, callback)
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
        handleProfilingResult(result.resultFilePath, result.triggerType)
    }

    @VisibleForTesting
    internal fun handleProfilingResult(filePath: String?, triggerType: Int) {
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
        val reason = reasonFor(triggerType)
        if (reason == null) {
            logger.log(
                LogLevel.Debug,
                "Discarding profile with unrecognized trigger: $triggerType",
            )
            return
        }
        if (!sampler.shouldSampleProfile()) {
            return
        }
        val profileTimeMs = profileTimeFor(file)
        // Matching a received profile to the correct session is based on
        // the following heuristics. This applies to ANRs as the profiles
        // for an ANR may arrive in the next app launch.
        //
        // 1. When an ANR happens the time is written to the sessions table.
        // 2. When an ANR profile is received, the session with the most recent
        //    ANR marked in the sessions table (including the current session)
        //    is returned, provided that ANR happened at most
        //    MAX_ANR_TO_PROFILE_GAP_MS before the profile time — a profile is
        //    created within seconds of its ANR, so an older match would be a
        //    stale, unrelated ANR.
        // 3. Otherwise, and for all other profile types, the profile is
        //    attributed to the active session.
        val anrSession = if (reason == REASON_ANR) {
            sessionManager.getSessionForAnr(profileTimeMs, MAX_ANR_TO_PROFILE_GAP_MS)
        } else {
            null
        }
        val session = anrSession ?: sessionManager.getSessionForTime(profileTimeMs)
        signalProcessor.trackProfile(
            data = ProfileData(reason = reason, format = format),
            timestamp = anrSession?.lastAnrTime ?: profileTimeMs,
            type = EventType.PROFILE,
            attachments = mutableListOf(
                Attachment(name = file.name, type = format, path = filePath),
            ),
            sessionId = session?.id ?: sessionManager.getSessionId(),
            sessionStartTime = session?.createdAt,
            appVersion = session?.appVersion,
            appBuild = session?.appBuild,
        )
    }

    // the platform stamps the file name with device-local wall clock time.
    // e.g. profile_trigger-type-2_2026-07-13-18-52-49.perfetto-trace.
    private fun profileTimeFor(file: File): Long {
        val timestamp = TIMESTAMP_REGEX.find(file.name)?.value?.let {
            try {
                SimpleDateFormat(TIMESTAMP_PATTERN, Locale.US).parse(it)?.time
            } catch (_: ParseException) {
                null
            }
        }
        return timestamp
            ?: file.lastModified().takeIf { it > 0 }
            ?: timeProvider.now()
    }

    private fun formatFor(fileName: String): String? = when {
        fileName.endsWith(PERFETTO_TRACE_EXTENSION) -> AttachmentType.PERFETTO_TRACE
        fileName.endsWith(HEAP_DUMP_EXTENSION) -> AttachmentType.HEAP_DUMP
        fileName.endsWith(HEAP_PROFILE_EXTENSION) -> AttachmentType.HEAP_PROFILE
        else -> null
    }

    private fun reasonFor(triggerType: Int): String? = when (triggerType) {
        ProfilingTrigger.TRIGGER_TYPE_APP_FULLY_DRAWN -> REASON_APP_FULLY_DRAWN
        ProfilingTrigger.TRIGGER_TYPE_ANR -> REASON_ANR
        else -> null
    }

    companion object {
        private const val RATE_LIMITING_PERIOD_HOURS = 1
        private const val PERFETTO_TRACE_EXTENSION = ".perfetto-trace"
        private const val HEAP_DUMP_EXTENSION = ".hprof"
        private const val HEAP_PROFILE_EXTENSION = ".heapprofd"
        private const val TIMESTAMP_PATTERN = "yyyy-MM-dd-HH-mm-ss"
        private val TIMESTAMP_REGEX = Regex("\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}")
        private const val REASON_APP_FULLY_DRAWN = "app_fully_drawn"
        private const val REASON_ANR = "anr"
        private const val MAX_ANR_TO_PROFILE_GAP_MS = 3 * 60 * 1000L
    }
}
