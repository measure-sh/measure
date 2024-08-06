package sh.measure.android.storage

import android.content.Context
import android.content.SharedPreferences
import sh.measure.android.attributes.Attribute

internal interface PrefsStorage {
    fun getInstallationId(): String?
    fun setInstallationId(installationId: String)
    fun getUserId(): String?
    fun setUserId(userId: String?)
}

internal class PrefsStorageImpl(private val context: Context) : PrefsStorage {
    private val sharedPreferenceName = "sh.measure.android"

    private companion object {
        private const val USER_ID_KEY = "user_id"
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
}
