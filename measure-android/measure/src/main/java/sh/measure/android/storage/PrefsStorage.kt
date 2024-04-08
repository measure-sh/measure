package sh.measure.android.storage

import android.content.Context
import android.content.SharedPreferences

internal interface PrefsStorage {
    fun getInstallationId(): String?
    fun setInstallationId(installationId: String)
}

internal class PrefsStorageImpl(private val context: Context) : PrefsStorage {
    private val sharedPreferenceName = "sh.measure.android"
    private val installationIdKey = "installation_id"

    override fun getInstallationId(): String? {
        return getSharedPreferences().getString(installationIdKey, null)
    }

    override fun setInstallationId(installationId: String) {
        getSharedPreferences().edit().putString(installationIdKey, installationId).apply()
    }

    private fun getSharedPreferences(): SharedPreferences {
        return context.getSharedPreferences(sharedPreferenceName, Context.MODE_PRIVATE)
    }
}
