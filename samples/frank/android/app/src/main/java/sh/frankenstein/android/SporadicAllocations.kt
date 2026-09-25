package sh.frankenstein.android

import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import kotlin.random.Random

fun scheduleSporadicAllocations(): ScheduledExecutorService =
    Executors.newSingleThreadScheduledExecutor().also { scheduler ->
        scheduler.scheduleWithFixedDelay(
            {
                // Keep the allocation bounded and short-lived so this demo does not OOM.
                val allocation = ByteArray(Random.nextInt(32, 151) * 1024 * 1024)
                allocation[0] = 1
                Thread.sleep(2_000)
            },
            5,
            5,
            TimeUnit.SECONDS,
        )
    }
