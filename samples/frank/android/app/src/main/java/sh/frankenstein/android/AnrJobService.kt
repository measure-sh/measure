package sh.frankenstein.android

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.PersistableBundle

/**
 * A job that never returns from onStartJob. From Android 14 the system
 * raises an ANR when a job callback does not return in time. The system
 * reschedules the unfinished job, and a copy that runs long after the tap
 * finishes instead of blocking again.
 */
class AnrJobService : JobService() {
    override fun onStartJob(params: JobParameters?): Boolean {
        val scheduledAt = params?.extras?.getLong(EXTRA_SCHEDULED_AT) ?: 0
        if (System.currentTimeMillis() - scheduledAt > RESCHEDULED_AFTER_MS) {
            return false
        }
        Thread.sleep(Long.MAX_VALUE)
        return false
    }

    override fun onStopJob(params: JobParameters?): Boolean = false

    companion object {
        private const val JOB_ID = 4242
        private const val EXTRA_SCHEDULED_AT = "scheduled_at"
        private const val RESCHEDULED_AFTER_MS = 60_000L

        fun trigger(context: Context) {
            val job = JobInfo.Builder(JOB_ID, ComponentName(context, AnrJobService::class.java))
                .setOverrideDeadline(0)
                .setExtras(PersistableBundle().apply { putLong(EXTRA_SCHEDULED_AT, System.currentTimeMillis()) })
                .build()
            context.getSystemService(JobScheduler::class.java).schedule(job)
        }
    }
}
