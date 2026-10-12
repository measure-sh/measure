package sh.measure.android.attributes

import sh.measure.android.attributes.Attribute.USER_ID_KEY
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.utils.ValidationLimits
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Maintains the state for the user ID attribute. The user ID is set by the SDK user and can change
 * during the session. This class returns the latest user ID set by the user.
 */
internal class UserAttributeProcessor(
    private val logger: Logger,
    private val prefsStorage: PrefsStorage,
    private val ioExecutor: MeasureExecutorService,
) : AttributeProcessor {
    private val loadedFromDisk = AtomicBoolean(false)
    private var userId: String? = null

    override fun appendAttributes(attributes: MutableMap<String, Any?>) {
        if (!loadedFromDisk.getAndSet(true)) {
            userId = prefsStorage.getUserId()
            if ((userId?.length ?: 0) > ValidationLimits.USER_ID) {
                clearUserId()
            }
        }
        attributes[USER_ID_KEY] = userId
    }

    fun setUserId(userId: String) {
        if (userId.length > ValidationLimits.USER_ID) {
            logger.log(
                LogLevel.Error,
                "User ID exceeds the maximum length of ${ValidationLimits.USER_ID} characters and will be ignored",
            )
            return
        }
        this.userId = userId
        ioExecutor.submit {
            prefsStorage.setUserId(userId)
            logger.log(LogLevel.Debug, "User ID saved")
        }
    }

    fun getUserId(): String? = userId

    fun clearUserId() {
        userId = null
        try {
            ioExecutor.submit {
                prefsStorage.setUserId(null)
                logger.log(LogLevel.Debug, "User ID cleared")
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Error, "Failed to clear user id", e)
        }
    }
}
