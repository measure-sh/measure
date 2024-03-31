package sh.measure.android.attributes

import sh.measure.android.events.Event

/**
 * Maintains the state for the user ID attribute. The user ID is set by the SDK user and can change
 * during the session. This class returns the latest user ID set by the user.
 */
internal class UserAttributeProcessor : AttributeProcessor {
    private val key = "user_id"
    private var userId: String? = null

    override fun appendAttributes(event: Event<*>) {
        event.attributes[key] = userId
    }

    fun setUserId(userId: String) {
        this.userId = userId
    }
}
