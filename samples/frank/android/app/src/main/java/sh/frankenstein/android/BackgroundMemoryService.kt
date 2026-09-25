package sh.frankenstein.android

import android.app.Service
import android.content.Intent
import android.os.IBinder
import java.util.concurrent.ScheduledExecutorService

/**
 * A started service without a notification. It keeps a backgrounded process at
 * service importance until the system stops it, about a minute after the app
 * leaves the foreground.
 */
class BackgroundMemoryService : Service() {
    private var executor: ScheduledExecutorService? = null

    override fun onCreate() {
        super.onCreate()
        executor = scheduleSporadicAllocations()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY

    override fun onDestroy() {
        executor?.shutdownNow()
        executor = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
