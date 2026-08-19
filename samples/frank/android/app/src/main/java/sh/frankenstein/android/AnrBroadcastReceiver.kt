package sh.frankenstein.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import java.util.concurrent.CountDownLatch

class AnrBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        synchronized(lock) {
            Log.e("Frankenstein", "There should be an ANR before this message")
        }
    }

    companion object {
        private val lock = Any()

        fun trigger(context: Context) {
            val acquired = CountDownLatch(1)
            val holder = Thread {
                synchronized(lock) {
                    acquired.countDown()
                    Thread.sleep(Long.MAX_VALUE)
                }
            }
            holder.name = "APP: Locker"
            holder.isDaemon = true
            holder.start()
            acquired.await()
            val intent = Intent(context, AnrBroadcastReceiver::class.java)
                .addFlags(Intent.FLAG_RECEIVER_FOREGROUND)
            context.sendOrderedBroadcast(intent, null)
        }
    }
}
