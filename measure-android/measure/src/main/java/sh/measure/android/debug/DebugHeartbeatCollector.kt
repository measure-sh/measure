package sh.measure.android.debug

import android.content.Context
import sh.measure.android.MeasureClient
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * A debug helper class that sends periodic heartbeats to the server. It is enabled **only**
 * for the sample app for testing purposes.
 */
internal class DebugHeartbeatCollector(
    private val context: Context, private val client: MeasureClient
) {
    private val executor: ScheduledExecutorService by lazy { Executors.newSingleThreadScheduledExecutor() }

    fun register() {
        if (!context.packageName.contains("sh.measure.sample")) {
            return
        }
        executor.scheduleAtFixedRate({
            client.captureHeartbeat("Heartbeat")
        }, 0, 10, TimeUnit.SECONDS)
    }
}
