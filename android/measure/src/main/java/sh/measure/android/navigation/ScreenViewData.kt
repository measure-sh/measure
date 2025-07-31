package sh.measure.android.navigation

import android.annotation.SuppressLint
import kotlinx.serialization.Serializable
import sh.measure.android.cel.CelFieldAccessor

/**
 * Trigger when a screen is viewed by the user.
 */
@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class ScreenViewData(
    val name: String,
): CelFieldAccessor {
    override fun getField(fieldName: String): Any? {
        return when (fieldName) {
            "name" -> name
            else -> null
        }
    }
}
