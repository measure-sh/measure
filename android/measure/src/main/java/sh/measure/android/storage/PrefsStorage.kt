package sh.measure.android.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import sh.measure.android.attributes.Attribute

internal interface PrefsStorage {
    fun getInstallationId(): String?
    fun setInstallationId(installationId: String)
    fun getUserId(): String?
    fun setUserId(userId: String?)
    fun getConfigFetchTimestamp(): Long
    fun getConfigCacheControl(): Long
    fun getConfigEtag(): String?
    fun setConfigFetchTimestamp(timestamp: Long)
    fun setConfigCacheControl(cacheControl: Long)
    fun setConfigEtag(etag: String)
}

internal class PrefsStorageImpl(private val context: Context) : PrefsStorage {
    private val sharedPreferenceName = "sh.measure.android"

    private companion object {
        private const val USER_ID_KEY = "user_id"
        private const val CONFIG_FETCH_TIMESTAMP = "config_fetch_timestamp"
        private const val CONFIG_CACHE_CONTROL = "config_cache_control"
        private const val CONFIG_ETAG = "config_etag"
    }

    private val sharedPreferences: SharedPreferences by lazy {
        context.getSharedPreferences(sharedPreferenceName, Context.MODE_PRIVATE)
    }

    override fun getInstallationId(): String? = sharedPreferences.getString(Attribute.INSTALLATION_ID_KEY, null)

    override fun setInstallationId(installationId: String) {
        sharedPreferences.edit { putString(Attribute.INSTALLATION_ID_KEY, installationId) }
    }

    override fun getUserId(): String? = sharedPreferences.getString(USER_ID_KEY, null)

    override fun setUserId(userId: String?) {
        if (userId == null) {
            sharedPreferences.edit { remove(USER_ID_KEY) }
        } else {
            sharedPreferences.edit { putString(USER_ID_KEY, userId) }
        }
    }

    override fun getConfigFetchTimestamp(): Long = sharedPreferences.getLong(CONFIG_FETCH_TIMESTAMP, 0)

    override fun getConfigCacheControl(): Long = sharedPreferences.getLong(CONFIG_CACHE_CONTROL, 0)

    override fun getConfigEtag(): String? = sharedPreferences.getString(CONFIG_ETAG, null)

    override fun setConfigFetchTimestamp(timestamp: Long) {
        sharedPreferences.edit { putLong(CONFIG_FETCH_TIMESTAMP, timestamp) }
    }

    override fun setConfigCacheControl(cacheControl: Long) {
        sharedPreferences.edit { putLong(CONFIG_CACHE_CONTROL, cacheControl) }
    }

    override fun setConfigEtag(etag: String) {
        sharedPreferences.edit { putString(CONFIG_ETAG, etag) }
    }
}
