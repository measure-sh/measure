/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Salomon BRYS
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
package sh.measure.android.anr

import android.app.ActivityManager
import android.app.ActivityManager.ProcessErrorStateInfo
import android.os.Debug
import android.os.Handler
import android.os.Looper
import android.os.Process
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.TimeProvider

/**
 * A watchdog timer thread that detects when the UI thread has frozen.
 */
internal class ANRWatchDog(
    private val systemServiceProvider: SystemServiceProvider,
    private val timeoutInterval: Int,
    private val timeProvider: TimeProvider,
    private val anrListener: ANRListener,
    private val mainHandler: Handler = Handler(Looper.getMainLooper()),
) : Thread() {
    interface ANRListener {
        fun onAppNotResponding(error: AnrError)
    }

    @Volatile
    private var tick: Long = 0

    @Volatile
    private var reported = false
    private val ticker = Runnable {
        tick = 0
        reported = false
    }

    /**
     * @noinspection BusyWait
     */
    override fun run() {
        var interval = timeoutInterval.toLong()
        while (!isInterrupted) {
            val needPost = tick == 0L
            tick += interval
            if (needPost) {
                mainHandler.post(ticker)
            }
            try {
                sleep(interval)
            } catch (e: InterruptedException) {
                currentThread().interrupt()
                return
            }

            // Ignore if the ANR is already reported.
            if (tick == 0L || reported) {
                continue
            }
            // If the debugger is connected, ignore ANR.
            if (Debug.isDebuggerConnected() || Debug.waitingForDebugger()) {
                reported = true
                continue
            }

            // Verify ANR state by checking activity manager ProcessErrorStateInfo.
            // Don't report an ANR if the process error state is not ANR.
            val activityManager = systemServiceProvider.activityManager
            val pid = Process.myPid()
            val processErrorState = captureProcessErrorState(activityManager, pid)
            if (processErrorState != null && processErrorState.condition != ProcessErrorStateInfo.NOT_RESPONDING) {
                continue
            }

            // If the main thread has not handled ticker, it is blocked. ANR.
            val message = "Application Not Responding for at least $timeoutInterval ms."
            val error = AnrError(
                mainHandler.looper.thread,
                timeProvider.currentTimeSinceEpochInMillis,
                message,
            )
            anrListener.onAppNotResponding(error)
            interval = timeoutInterval.toLong()
            reported = true
        }
    }

    private fun captureProcessErrorState(am: ActivityManager?, pid: Int): ProcessErrorStateInfo? {
        return try {
            val processes = am?.processesInErrorState ?: emptyList()
            processes.firstOrNull { it.pid == pid }
        } catch (exc: RuntimeException) {
            null
        }
    }
}
