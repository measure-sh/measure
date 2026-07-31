package sh.frankenstein.android

import android.app.Service
import android.app.job.JobParameters
import android.app.job.JobService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.IBinder

// Outlasts every timeout the components below can hit, so the system
// raises the ANR rather than the block ending first.
private const val BLOCK_MS = 40_000L

internal const val ANR_JOB_ID = 1001

/**
 * Blocks the main thread inside onReceive. The system reports this as
 * `Broadcast of Intent { ... }` once the receiver deadline expires,
 * 10s for a foreground broadcast.
 */
class AnrBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Thread.sleep(BLOCK_MS)
    }
}

/**
 * Blocks the main thread inside onStartCommand. The system reports
 * this as `Executing service ...` after 20s while the app is in the
 * foreground.
 */
class AnrService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Thread.sleep(BLOCK_MS)
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

/**
 * Blocks the main thread inside onStartJob. The system reports this
 * as `No response to onStartJob` on API 34 and above; older releases
 * fail the job silently instead.
 */
class AnrJobService : JobService() {
    override fun onStartJob(params: JobParameters?): Boolean {
        Thread.sleep(BLOCK_MS)
        return false
    }

    override fun onStopJob(params: JobParameters?): Boolean = false
}
