package sh.measure.android.attributes

import sh.measure.android.config.ConfigProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.isLowerCase
import java.util.concurrent.ConcurrentHashMap

internal interface UserDefinedAttribute {
    fun put(key: String, value: Any)
    fun get(key: String): Any?
    fun getAll(): Map<String, Any?>
    fun remove(key: String)
    fun clear()
}

internal class UserDefinedAttributeImpl(
    private val logger: Logger,
    private val configProvider: ConfigProvider,
) : UserDefinedAttribute {
    private val attributes = ConcurrentHashMap<String, Any?>()

    override fun put(key: String, value: Any) {
        if (!validateKey(key) || !validateValue(value)) {
            return
        }
        attributes[key] = value
    }

    override fun remove(key: String) {
        try {
            attributes.remove(key)
        } catch (npe: NullPointerException) {
            logger.log(
                LogLevel.Warning,
                "Unable to remove attribute: $key, as it does not exist"
            )
        }
    }

    override fun clear() {
        attributes.clear()
    }

    override fun get(key: String): Any? {
        return attributes[key]
    }

    override fun getAll(): Map<String, Any?> {
        return attributes
    }

    private fun validateKey(key: String): Boolean {
        if (key.length > configProvider.defaultMaxUserDefinedAttributeKeyLength) {
            logger.log(
                LogLevel.Warning,
                "Attribute key: $key length is longer than the maximum allowed length of ${configProvider.defaultMaxUserDefinedAttributeKeyLength}. This attribute will be dropped."
            )
            return false
        } else if (!key.isLowerCase()) {
            logger.log(
                LogLevel.Warning,
                "Attribute key: $key must contain lower case characters only. This attribute will be dropped."
            )
            return false
        } else if (key.contains(" ")) {
            logger.log(
                LogLevel.Warning,
                "Attribute key: $key must not contain spaces. This attribute will be dropped."
            )
            return false
        }
        return true
    }

    private fun validateValue(value: Any?): Boolean {
        if (value is String) {
            if (value.length > configProvider.defaultMaxUserDefinedAttributeValueLength) {
                logger.log(
                    LogLevel.Warning,
                    "Attribute value: $value length is longer than the maximum allowed length of ${configProvider.defaultMaxUserDefinedAttributeValueLength}. This attribute will be dropped."
                )
                return false
            }
        }
        return true
    }
}