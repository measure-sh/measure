package sh.measure.android.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import sh.measure.android.attributes.Attribute

internal data class PreviousSession(
    val id: String,
    val startTime: Long,
    val pid: Int,
    val appVersion: String?,
    val appBuild: String?,
)

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

    /**
     * Records the given session details as the current session, moving the previously recorded
     * current session into the "previous session" slot.
     */
    fun rotateSession(id: String, startTime: Long, pid: Int, appVersion: String?, appBuild: String?)

    /**
     * Returns the session that was active before the current one, or `null` if there isn't one.
     */
    fun getPreviousSession(): PreviousSession?
}

internal class PrefsStorageImpl(private val context: Context) : PrefsStorage {
    private val sharedPreferenceName = "sh.measure.android"

    private companion object {
        private const val USER_ID_KEY = "user_id"
        private const val CONFIG_FETCH_TIMESTAMP = "config_fetch_timestamp"
        private const val CONFIG_CACHE_CONTROL = "config_cache_control"
        private const val CONFIG_ETAG = "config_etag"
        private const val CURRENT_SESSION_ID = "current_session_id"
        private const val CURRENT_SESSION_START_TIME = "current_session_start_time"
        private const val CURRENT_SESSION_PID = "current_session_pid"
        private const val CURRENT_SESSION_APP_VERSION = "current_session_app_version"
        private const val CURRENT_SESSION_APP_BUILD = "current_session_app_build"
        private const val PREVIOUS_SESSION_ID = "previous_session_id"
        private const val PREVIOUS_SESSION_START_TIME = "previous_session_start_time"
        private const val PREVIOUS_SESSION_PID = "previous_session_pid"
        private const val PREVIOUS_SESSION_APP_VERSION = "previous_session_app_version"
        private const val PREVIOUS_SESSION_APP_BUILD = "previous_session_app_build"
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

    override fun rotateSession(
        id: String,
        startTime: Long,
        pid: Int,
        appVersion: String?,
        appBuild: String?,
    ) {
        val currentId = sharedPreferences.getString(CURRENT_SESSION_ID, null)
        val currentStartTime = sharedPreferences.getLong(CURRENT_SESSION_START_TIME, 0)
        val currentPid = sharedPreferences.getInt(CURRENT_SESSION_PID, 0)
        val currentAppVersion = sharedPreferences.getString(CURRENT_SESSION_APP_VERSION, null)
        val currentAppBuild = sharedPreferences.getString(CURRENT_SESSION_APP_BUILD, null)
        sharedPreferences.edit {
            if (currentId != null) {
                putString(PREVIOUS_SESSION_ID, currentId)
                putLong(PREVIOUS_SESSION_START_TIME, currentStartTime)
                putInt(PREVIOUS_SESSION_PID, currentPid)
                putString(PREVIOUS_SESSION_APP_VERSION, currentAppVersion)
                putString(PREVIOUS_SESSION_APP_BUILD, currentAppBuild)
            }
            putString(CURRENT_SESSION_ID, id)
            putLong(CURRENT_SESSION_START_TIME, startTime)
            putInt(CURRENT_SESSION_PID, pid)
            putString(CURRENT_SESSION_APP_VERSION, appVersion)
            putString(CURRENT_SESSION_APP_BUILD, appBuild)
        }
    }

    override fun getPreviousSession(): PreviousSession? {
        val id = sharedPreferences.getString(PREVIOUS_SESSION_ID, null) ?: return null
        return PreviousSession(
            id = id,
            startTime = sharedPreferences.getLong(PREVIOUS_SESSION_START_TIME, 0),
            pid = sharedPreferences.getInt(PREVIOUS_SESSION_PID, 0),
            appVersion = sharedPreferences.getString(PREVIOUS_SESSION_APP_VERSION, null),
            appBuild = sharedPreferences.getString(PREVIOUS_SESSION_APP_BUILD, null),
        )
    }
}
