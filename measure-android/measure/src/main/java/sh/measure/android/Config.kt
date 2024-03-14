package sh.measure.android

private val disabledHttpBodyUrlPatterns = listOf(
    // measure sessions endpoint for local development
    // TODO(abhay): always ignore all measure endpoints
    "10.0.2.2:8080/sessions",
)

private val enabledHttpBodyContentTypePatterns = listOf(
    "application/json",
)

/**
 * Configures behavior of the Measure SDK.
 */
internal interface Config {
    /**
     * Returns `true` if the HTTP body should be tracked for the given URL and content type.
     */
    fun trackHttpBody(url: String, contentType: String?): Boolean
}

internal class DefaultConfig : Config {
    override fun trackHttpBody(url: String, contentType: String?): Boolean {
        if (contentType.isNullOrEmpty()) {
            return false
        }
        if (disabledHttpBodyUrlPatterns.any { url.contains(it) }) {
            return false
        }
        return enabledHttpBodyContentTypePatterns.any { contentType.startsWith(it) }
    }
}
