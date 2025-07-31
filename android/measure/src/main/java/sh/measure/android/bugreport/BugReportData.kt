package sh.measure.android.bugreport

import android.annotation.SuppressLint
import kotlinx.serialization.Serializable
import sh.measure.android.cel.CelFieldAccessor

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class BugReportData(val description: String): CelFieldAccessor {
    override fun getField(fieldName: String): Any? {
        return when (fieldName) {
            "description" -> description
            else -> null
        }
    }
}
