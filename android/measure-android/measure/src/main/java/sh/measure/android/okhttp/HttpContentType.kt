package sh.measure.android.okhttp

/**
 * HTTP bodies are only collected for JSON content. Non-JSON bodies (images,
 * protobuf, gzip, etc.) are binary and render as garbled text in the timeline.
 */
internal fun isJsonContentType(contentType: String?): Boolean = contentType?.startsWith("application/json", ignoreCase = true) == true
