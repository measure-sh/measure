package sh.measure.android.attributes

/**
 * Maintains the state for the user ID attribute. The user ID is set by the SDK user and can change
 * during the session. This class returns the latest user ID set by the user.
 */
internal class UserIdAttributeAppender : AttributeAppender {
    private val key = "user_id"
    private var userId: String? = null

    override fun append(attrs: MutableMap<String, Any?>) {
        attrs[key] = userId
    }

    fun setUserId(userId: String) {
        this.userId = userId
    }
}