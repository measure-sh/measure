package sh.measure.android.attributes

/**
 * Maintains the state for the user ID attribute. The user ID is set by the SDK user and can change
 * during the session. This class returns the latest user ID set by the user.
 */
internal class UserAttributeProcessor : AttributeProcessor {
    private val key = "user_id"
    private var userId: String? = null

    override fun appendAttributes(attributes: MutableMap<String, Any?>) {
        // if null, load user ID from disk if available, then return
        // blocks on I/O.
        attributes[key] = userId
    }

    fun setUserId(userId: String) {
        this.userId = userId
        // TODO: persist user ID to disk async
    }

    fun clearUserId() {
        userId = null
    }
}
