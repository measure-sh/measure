package sh.measure.android.storage

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import sh.measure.android.RecentSession
import sh.measure.android.attributes.Attribute

internal interface PrefsStorage {
    fun getInstallationId(): String?
    fun setInstallationId(installationId: String)
    fun getUserId(): String?
    fun setUserId(userId: String?)
    fun setRecentSession(recentSession: RecentSession)
    fun setRecentSessionCrashed()
    fun setRecentSessionEventTime(timestamp: Long)
    fun getRecentSession(): RecentSession?
}

internal class PrefsStorageImpl(private val context: Context) : PrefsStorage {
    private val sharedPreferenceName = "sh.measure.android"

    private companion object {
        private const val USER_ID_KEY = "user_id"
        private const val RECENT_SESSION_ID = "rs_id"
        private const val RECENT_SESSION_CREATED_AT = "rs_created_at"
        private const val RECENT_SESSION_EVENT_TIME = "rs_event_time"
        private const val RECENT_SESSION_CRASHED = "rs_crashed"
        private const val RECENT_SESSION_VERSION_CODE = "rs_version_code"
    }

    private val sharedPreferences: SharedPreferences by lazy {
        context.getSharedPreferences(sharedPreferenceName, Context.MODE_PRIVATE)
    }

    override fun getInstallationId(): String? = sharedPreferences.getString(Attribute.INSTALLATION_ID_KEY, null)

    override fun setInstallationId(installationId: String) {
        sharedPreferences.edit().putString(Attribute.INSTALLATION_ID_KEY, installationId).apply()
    }

    override fun getUserId(): String? = sharedPreferences.getString(USER_ID_KEY, null)

    override fun setUserId(userId: String?) {
        if (userId == null) {
            sharedPreferences.edit().remove(USER_ID_KEY).apply()
        } else {
            sharedPreferences.edit().putString(USER_ID_KEY, userId).apply()
        }
    }

    override fun setRecentSession(recentSession: RecentSession) {
        sharedPreferences.edit().putString(RECENT_SESSION_ID, recentSession.id)
            .putLong(RECENT_SESSION_EVENT_TIME, recentSession.lastEventTime)
            .putLong(RECENT_SESSION_CREATED_AT, recentSession.createdAt)
            .putBoolean(RECENT_SESSION_CRASHED, recentSession.crashed)
            .putString(RECENT_SESSION_VERSION_CODE, recentSession.versionCode).apply()
    }

    @SuppressLint("ApplySharedPref")
    override fun setRecentSessionCrashed() {
        // The app is crashing, using commit to have a better chance for the write to succeed.
        sharedPreferences.edit().putBoolean(RECENT_SESSION_CRASHED, true).commit()
    }

    override fun setRecentSessionEventTime(timestamp: Long) {
        sharedPreferences.edit().putLong(RECENT_SESSION_EVENT_TIME, timestamp).apply()
    }

    override fun getRecentSession(): RecentSession? {
        val sessionId = sharedPreferences.getString(RECENT_SESSION_ID, null)
        val eventTime = sharedPreferences.getLong(RECENT_SESSION_EVENT_TIME, 0)
        val crashed = sharedPreferences.getBoolean(RECENT_SESSION_CRASHED, false)
        val createdAt = sharedPreferences.getLong(RECENT_SESSION_CREATED_AT, 0)
        val versionCode = sharedPreferences.getString(RECENT_SESSION_VERSION_CODE, null)
        if (sessionId == null || versionCode == null) {
            return null
        }
        return RecentSession(
            id = sessionId,
            lastEventTime = eventTime,
            createdAt = createdAt,
            crashed = crashed,
            versionCode = versionCode,
        )
    }
}
