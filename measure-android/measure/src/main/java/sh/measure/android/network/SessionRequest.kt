package sh.measure.android.network

import kotlinx.serialization.json.JsonElement

/**
 * The request body schema for sending a session to the server.
 */
data class SessionRequest(
    val session_id: String,
    val timestamp: Long,
    val resource: JsonElement,
    val events: List<JsonElement>,
)