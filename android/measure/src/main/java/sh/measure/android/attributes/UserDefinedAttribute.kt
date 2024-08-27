package sh.measure.android.attributes

import sh.measure.android.config.ConfigProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.isLowerCase
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.RejectedExecutionException

internal interface UserDefinedAttribute {
    fun put(key: String, value: Number)
    fun put(key: String, value: String)
    fun put(key: String, value: Boolean)
    fun getAll(): Map<String, Any?>
    fun remove(key: String)
    fun clear()
}

internal class UserDefinedAttributeImpl(
    private val logger: Logger,
    private val configProvider: ConfigProvider,
) : UserDefinedAttribute {
    private val attributes = ConcurrentHashMap<String, Any?>()

    override fun put(key: String, value: Number) {
        if (validate(key, value)) {
            attributes[key] = value
        }
    }

    override fun put(key: String, value: String) {
        if (validate(key, value)) {
            attributes[key] = value
        }
    }

    override fun put(key: String, value: Boolean) {
        if (validate(key, value)) {
            attributes[key] = value
        }
    }

    override fun getAll(): Map<String, Any?> {
        return attributes.toMap()
    }

    override fun remove(key: String) {
        try {
            attributes.remove(key)
        } catch (npe: NullPointerException) {
            logger.log(
                LogLevel.Warning,
                "Unable to remove attribute: $key, as it does not exist",
            )
        } catch (e: RejectedExecutionException) {
            logger.log(
                LogLevel.Error,
                "Failed to submit remove user defined attribute task to executor",
                e
            )
        }
    }

    override fun clear() {
        attributes.clear()
    }

    private fun validate(key: String, value: Any?): Boolean {
        return validateKey(key) && validateValue(value)
    }

    private fun validateKey(key: String): Boolean {
        if (key.length > configProvider.maxUserDefinedAttributeKeyLength) {
            logger.log(
                LogLevel.Warning,
                "Attribute key: $key length is longer than the maximum allowed length of ${configProvider.maxUserDefinedAttributeKeyLength}. This attribute will be dropped.",
            )
            return false
        } else if (!key.isLowerCase()) {
            logger.log(
                LogLevel.Warning,
                "Attribute key: $key must contain lower case characters only. This attribute will be dropped.",
            )
            return false
        } else if (key.contains(" ")) {
            logger.log(
                LogLevel.Warning,
                "Attribute key: $key must not contain spaces. This attribute will be dropped.",
            )
            return false
        }
        return true
    }

    private fun validateValue(value: Any?): Boolean {
        if (value is String) {
            if (value.length > configProvider.maxUserDefinedAttributeValueLength) {
                logger.log(
                    LogLevel.Warning,
                    "Attribute value: $value length is longer than the maximum allowed length of ${configProvider.maxUserDefinedAttributeValueLength}. This attribute will be dropped.",
                )
                return false
            }
        }
        return true
    }
}
