package sh.measure.android

import android.os.Looper

internal val isMainThread: Boolean get() = Looper.getMainLooper().thread === Thread.currentThread()

internal fun checkMainThread() {
    check(isMainThread) {
        "This method must be called from the main thread, but current thread is ${Thread.currentThread().name}"
    }
}
