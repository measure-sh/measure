package sh.measure.android.attributes

import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.utils.isLowerCase
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

internal interface UserDefinedAttribute {
    fun put(key: String, value: Number, store: Boolean)
    fun put(key: String, value: String, store: Boolean)
    fun put(key: String, value: Boolean, store: Boolean)
    fun getAll(): Map<String, Any?>
    fun remove(key: String)
    fun clear()
}

internal class UserDefinedAttributeImpl(
    private val logger: Logger,
    private val configProvider: ConfigProvider,
    private val database: Database,
    private val ioExecutor: MeasureExecutorService,
) : UserDefinedAttribute {
    // used to ensure that the attributes are loaded from disk only once
    // given all further operations are done in memory and then persisted to disk
    private val loadedFromDisk = AtomicBoolean(false)
    private val attributes = ConcurrentHashMap<String, Any?>()

    override fun put(key: String, value: Number, store: Boolean) {
        if (validate(key, value)) {
            attributes[key] = value
            if (store) {
                ioExecutor.submit {
                    database.insertUserDefinedAttribute(key, value)
                }
            }
        }
    }

    override fun put(key: String, value: String, store: Boolean) {
        if (validate(key, value)) {
            attributes[key] = value
            if (store) {
                ioExecutor.submit {
                    database.insertUserDefinedAttribute(key, value)
                }
            }
        }
    }

    override fun put(key: String, value: Boolean, store: Boolean) {
        if (validate(key, value)) {
            attributes[key] = value
            if (store) {
                ioExecutor.submit {
                    database.insertUserDefinedAttribute(key, value)
                }
            }
        }
    }

    override fun getAll(): Map<String, Any?> {
        if (loadedFromDisk.getAndSet(true)) {
            val persistedAttributes = database.getUserDefinedAttributes()
            attributes.putAll(persistedAttributes)
        }
        return attributes.toMap()
    }

    override fun remove(key: String) {
        try {
            attributes.remove(key)
            ioExecutor.submit {
                database.removeUserDefinedAttribute(key)
            }
        } catch (npe: NullPointerException) {
            logger.log(
                LogLevel.Warning,
                "Unable to remove attribute: $key, as it does not exist"
            )
        }
    }

    override fun clear() {
        attributes.clear()
        ioExecutor.submit {
            database.clearUserDefinedAttributes()
        }
    }

    private fun validate(key: String, value: Any?): Boolean {
        return validateKey(key) && validateValue(value)
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