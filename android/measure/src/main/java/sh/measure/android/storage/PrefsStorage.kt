package sh.measure.android.storage

import android.content.Context
import android.content.SharedPreferences
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import sh.measure.android.RecentSession
import sh.measure.android.attributes.Attribute
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

internal interface PrefsStorage {
    fun getInstallationId(): String?
    fun setInstallationId(installationId: String)
    fun getUserId(): String?
    fun setUserId(userId: String?)
    fun setRecentSession(recentSession: RecentSession)
    fun getRecentSession(): RecentSession?
}

internal class PrefsStorageImpl(private val logger: Logger, private val context: Context) :
    PrefsStorage {
    private val sharedPreferenceName = "sh.measure.android"

    private companion object {
        private const val USER_ID_KEY = "user_id"
        private const val RECENT_SESSION = "recent_session"
    }

    private val sharedPreferences: SharedPreferences by lazy {
        context.getSharedPreferences(sharedPreferenceName, Context.MODE_PRIVATE)
    }

    override fun getInstallationId(): String? {
        return sharedPreferences.getString(Attribute.INSTALLATION_ID_KEY, null)
    }

    override fun setInstallationId(installationId: String) {
        sharedPreferences.edit().putString(Attribute.INSTALLATION_ID_KEY, installationId).apply()
    }

    override fun getUserId(): String? {
        return sharedPreferences.getString(USER_ID_KEY, null)
    }

    override fun setUserId(userId: String?) {
        if (userId == null) {
            sharedPreferences.edit().remove(USER_ID_KEY).apply()
        } else {
            sharedPreferences.edit().putString(USER_ID_KEY, userId).apply()
        }
    }

    override fun setRecentSession(recentSession: RecentSession) {
        try {
            val eventStr = Json.encodeToString(RecentSession.serializer(), recentSession)
            sharedPreferences.edit().putString(RECENT_SESSION, eventStr).apply()
        } catch (e: SerializationException) {
            logger.log(LogLevel.Error, "Unable to store recent session to shared prefs", e)
        }
    }

    override fun getRecentSession(): RecentSession? {
        val sessionStr = sharedPreferences.getString(RECENT_SESSION, null) ?: return null
        return try {
            Json.decodeFromString(RecentSession.serializer(), sessionStr)
        } catch (e: SerializationException) {
            logger.log(LogLevel.Error, "Unable to read recent session from shared prefs", e)
            null
        }
    }
}
