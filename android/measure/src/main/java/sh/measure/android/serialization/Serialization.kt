package sh.measure.android.serialization

import kotlinx.serialization.json.Json

/**
 * A JSON serializer that ignores unknown keys. Used as a default serializer for all
 * [kotlinx.serialization.Serializable] classes.
 */
internal val jsonSerializer = Json {
    ignoreUnknownKeys = true
}
