package sh.frankenstein.android

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

object CredentialOverrides {
    private const val PREFS_NAME = "measure_credential_overrides"
    private const val KEY_API_URL = "api_url"
    private const val KEY_API_KEY = "api_key"

    fun getSavedApiUrl(context: Context): String? =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_API_URL, null)

    fun getSavedApiKey(context: Context): String? =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_API_KEY, null)

    fun save(context: Context, apiUrl: String, apiKey: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_API_URL, apiUrl)
            .putString(KEY_API_KEY, apiKey)
            .apply()
    }

    fun readManifestCredentials(context: Context): Pair<String?, String?> {
        return try {
            val pm = context.packageManager
            val appInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getApplicationInfo(
                    context.packageName,
                    PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong()),
                )
            } else {
                @Suppress("DEPRECATION")
                pm.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
            }
            val metaData = appInfo.metaData
            val url = metaData?.getString("sh.measure.android.API_URL")
            val key = metaData?.getString("sh.measure.android.API_KEY")
            Pair(url, key)
        } catch (e: PackageManager.NameNotFoundException) {
            Pair(null, null)
        }
    }
}
