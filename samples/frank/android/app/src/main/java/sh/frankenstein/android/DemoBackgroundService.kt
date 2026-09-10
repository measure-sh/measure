package sh.frankenstein.android

import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper

/**
 * A plain (non-foreground) started service purely for demoing Android's
 * IMPORTANCE_SERVICE process state (Measure's "background") — runs for a
 * fixed duration, then stops itself. Must be started while the app is in
 * the foreground: Android 8+ refuses to start a background service from an
 * already-backgrounded app, but once running, backgrounding the app
 * afterward does not stop it.
 */
class DemoBackgroundService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val stopRunnable = Runnable { stopSelf() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        handler.postDelayed(stopRunnable, DURATION_MS)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(stopRunnable)
        super.onDestroy()
    }

    companion object {
        private const val DURATION_MS = 90_000L
    }
}
