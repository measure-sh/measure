package sh.frankenstein.android

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder

/**
 * A started service that never returns from onStartCommand, so the system
 * raises an "executing service" ANR once the service timeout expires. The
 * system restarts a service killed mid-start, and the restart stops instead
 * of blocking again.
 */
class AnrService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (flags and (START_FLAG_RETRY or START_FLAG_REDELIVERY) != 0) {
            stopSelf()
            return START_NOT_STICKY
        }
        Thread.sleep(Long.MAX_VALUE)
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        fun trigger(context: Context) {
            context.startService(Intent(context, AnrService::class.java))
        }
    }
}
