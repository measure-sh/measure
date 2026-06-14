package sh.measure.android.exceptions

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The severity of an exception.
 */
@Serializable
internal enum class ExceptionSeverity {
    /**
     * An unhandled exception or ANR that crashed the app.
     */
    @SerialName("fatal")
    Fatal,

    /**
     * An exception tracked explicitly by the app using the public API.
     */
    @SerialName("handled")
    Handled,

    /**
     * An unhandled exception that did not crash the app.
     */
    @SerialName("unhandled")
    Unhandled,
}
