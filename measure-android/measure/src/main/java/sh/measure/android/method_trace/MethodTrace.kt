package sh.measure.android.method_trace

import android.os.Debug
import android.util.Log

internal class MethodTrace private constructor() {
    companion object {
        private var instance: MethodTrace? = null

        fun getInstance(): MethodTrace {
            return instance ?: synchronized(this) {
                instance ?: MethodTrace().also { instance = it }
            }
        }
    }

    @Volatile
    private var isTraceStarted = false

    fun start(config: MethodTraceConfig) {
        if (isTraceStarted) {
            Log.w("Measure", "A method trace is already running, ignoring this request.")
            return
        }
        isTraceStarted = true
        Debug.startMethodTracingSampling(
            config.absolutePath, config.bufferSize, config.intervalUs
        )
        Log.d("Measure", "Started method trace with config: $config")
    }

    fun stop() {
        if (!isTraceStarted) {
            Log.w("Measure", "No method trace running, ignoring this request.")
            return
        }
        Debug.stopMethodTracing()
        isTraceStarted = false
        Log.d("Measure", "Stopped method trace")
    }
}

internal data class MethodTraceConfig(
    val path: String, val name: String, val bufferSize: Int = 8 * 1024 * 1024, // 8MB
    val intervalUs: Int = 1000 * 100 // 100ms
) {
    val extension = "trace"
    val absolutePath = "${path}/${name}.${extension}"
}