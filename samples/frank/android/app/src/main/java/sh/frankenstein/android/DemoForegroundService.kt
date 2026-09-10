package sh.frankenstein.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper

/**
 * A foreground service purely for demoing Android's IMPORTANCE_FOREGROUND_SERVICE
 * process state (Measure's "user_perceived_service") while the app itself is
 * backgrounded — runs for a fixed duration with a visible notification, then
 * stops itself.
 */
class DemoForegroundService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val stopRunnable = Runnable { stopSelf() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        handler.postDelayed(stopRunnable, DURATION_MS)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(stopRunnable)
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Demo foreground service",
                    NotificationManager.IMPORTANCE_LOW,
                ),
            )
        }
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Frank demo")
            .setContentText("Foreground service running (memory process-state demo)")
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "demo_foreground_service"
        private const val NOTIFICATION_ID = 42001
        private const val DURATION_MS = 90_000L
    }
}
