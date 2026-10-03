package sh.frankenstein.android

import android.content.Context
import android.os.PowerManager
import java.util.concurrent.atomic.AtomicLong

// Incremented on every spin so R8 cannot drop the loop as having no effect.
private val burnedCycles = AtomicLong()

fun burnCpuUntilKilled(context: Context) {
    context.getSystemService(PowerManager::class.java)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "frank:excessive-cpu-usage")
        .acquire(10 * 60 * 1000L)
    repeat(Runtime.getRuntime().availableProcessors()) { index ->
        Thread(
            {
                while (true) {
                    burnedCycles.incrementAndGet()
                }
            },
            "CpuBurn-$index",
        ).apply { isDaemon = true }.start()
    }
}
