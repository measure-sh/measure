package sh.measure.android

import android.content.Context

/**
 * The public API for Measure. Use [Measure] to interact with the SDK.
 */
interface MeasureApi {
    fun init(context: Context)
    fun setUserId(userId: String)
}
