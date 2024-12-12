package sh.measure.android.tracing

/**
 * Annotates a specific time on a span.
 */
internal class Checkpoint(
    val name: String,
    val timestamp: Long,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as Checkpoint

        if (name != other.name) return false
        if (timestamp != other.timestamp) return false

        return true
    }

    override fun hashCode(): Int {
        var result = name.hashCode()
        result = 31 * result + timestamp.hashCode()
        return result
    }
}
