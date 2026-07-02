package sh.measure.android.profiling

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.util.concurrent.TimeUnit

/**
 * Schedules the [ProfileUploadWorker]. The work is unique and uses [ExistingWorkPolicy.KEEP], so
 * calling [schedule] on every export coalesces onto one worker instead of one job per profile.
 */
internal class ProfileUploadScheduler(
    private val context: Context,
    private val logger: Logger,
) {
    fun schedule() {
        try {
            WorkManager.getInstance(context)
                .enqueueUniqueWork(UNIQUE_WORK_NAME, ExistingWorkPolicy.KEEP, buildRequest())
        } catch (e: Exception) {
            // getInstance throws when the host disables WorkManager's default initializer without
            // providing a Configuration.Provider; degrade instead of crashing.
            logger.log(LogLevel.Error, "Failed to schedule profile upload", e)
        }
    }

    private fun buildRequest(): OneTimeWorkRequest {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()
        return OneTimeWorkRequest.Builder(ProfileUploadWorker::class.java)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, BACKOFF_SECONDS, TimeUnit.SECONDS)
            .build()
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "sh.measure.android.profile-upload"
        private const val BACKOFF_SECONDS = 30L
    }
}
