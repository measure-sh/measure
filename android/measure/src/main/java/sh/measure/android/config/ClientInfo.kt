package sh.measure.android.config

internal const val MEASURE_API_URL = "https://api.measure.sh"

/**
 * Identifiers required to connect to the Measure backend.
 *
 * This class is used during SDK initialization via `Measure.start(...)`.
 * It provides the SDK with the credentials and endpoint needed to send analytics data.
 *
 * ### Example
 * ```kotlin
 * val clientInfo = ClientInfo(
 *     apiKey = "your-api-key",
 *     apiUrl = "https://localhost:8080"
 * )
 *
 * Measure.start(
 *     clientInfo = clientInfo,
 *     config = MeasureConfig(...)
 * )
 * ```
 */
data class ClientInfo(
    /**
     * The API key assigned to your project. Available in the Measure dashboard.
     */
    val apiKey: String,

    /**
     * The backend URL where data will be sent. For self-host users this is available in the Measure
     * dashboard. For SaaS users this is set automatically.
     */
    val apiUrl: String = MEASURE_API_URL,
) {
    companion object {
        /**
         * Creates a [ClientInfo] object from a JSON map.
         */
        @Throws(IllegalArgumentException::class)
        fun fromJson(json: Map<String, String>): ClientInfo {
            val apiKey = json["apiKey"]

            if (apiKey.isNullOrEmpty()) {
                throw IllegalArgumentException("apiKey is mandatory")
            }
            val apiUrl = json["apiUrl"] ?: MEASURE_API_URL
            return ClientInfo(apiKey, apiUrl)
        }
    }
}
