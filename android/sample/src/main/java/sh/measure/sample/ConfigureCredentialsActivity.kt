package sh.measure.sample

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.ScrollView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText

class ConfigureCredentialsActivity : AppCompatActivity() {

    companion object {
        private const val PREFS_NAME = "measure_credential_overrides"
        private const val KEY_API_URL = "api_url"
        private const val KEY_API_KEY = "api_key"

        fun getSavedApiUrl(context: Context): String? {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(KEY_API_URL, null)
        }

        fun getSavedApiKey(context: Context): String? {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(KEY_API_KEY, null)
        }
    }

    private lateinit var etApiUrl: TextInputEditText
    private lateinit var etApiKey: TextInputEditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_configure_credentials)
        handleEdgeToEdgeDisplay()

        etApiUrl = findViewById(R.id.et_api_url)
        etApiKey = findViewById(R.id.et_api_key)

        loadCurrentValues()

        findViewById<MaterialButton>(R.id.btn_save).setOnClickListener {
            save()
        }
    }

    private fun loadCurrentValues() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedUrl = prefs.getString(KEY_API_URL, null)
        val savedKey = prefs.getString(KEY_API_KEY, null)

        if (savedUrl != null && savedKey != null) {
            etApiUrl.setText(savedUrl)
            etApiKey.setText(savedKey)
        } else {
            val (manifestUrl, manifestKey) = readManifestCredentials()
            etApiUrl.setText(manifestUrl)
            etApiKey.setText(manifestKey)
        }
    }

    private fun save() {
        val apiUrl = etApiUrl.text?.toString()?.trim().orEmpty()
        val apiKey = etApiKey.text?.toString()?.trim().orEmpty()

        if (apiUrl.isEmpty()) {
            etApiUrl.error = "API URL cannot be empty"
            return
        }
        if (!apiKey.startsWith("msrsh")) {
            etApiKey.error = "API Key must start with \"msrsh\""
            return
        }

        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_API_URL, apiUrl)
            .putString(KEY_API_KEY, apiKey)
            .apply()

        val success = MeasureConfigurator.swapCredentials(apiUrl, apiKey)
        if (success) {
            Toast.makeText(this, "Credentials saved and applied", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Saved, but failed to apply (SDK not initialized?)", Toast.LENGTH_SHORT).show()
        }
    }

    private fun readManifestCredentials(): Pair<String?, String?> {
        return try {
            val appInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getApplicationInfo(
                    packageName,
                    PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong()),
                )
            } else {
                @Suppress("DEPRECATION")
                packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
            }
            val metaData = appInfo.metaData
            val url = metaData?.getString("sh.measure.android.API_URL")
            val key = metaData?.getString("sh.measure.android.API_KEY")
            Pair(url, key)
        } catch (e: PackageManager.NameNotFoundException) {
            Pair(null, null)
        }
    }

    private fun handleEdgeToEdgeDisplay() {
        val container = findViewById<ScrollView>(R.id.sv_container)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ViewCompat.setOnApplyWindowInsetsListener(container) { view, windowInsets ->
                val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
                view.updatePadding(
                    left = insets.left,
                    top = insets.top,
                    right = insets.right,
                    bottom = insets.bottom,
                )
                windowInsets
            }
        } else {
            ViewCompat.setOnApplyWindowInsetsListener(container) { view, windowInsets ->
                @Suppress("DEPRECATION") val insets = windowInsets.systemWindowInsets
                view.updatePadding(
                    left = insets.left,
                    top = insets.top,
                    right = insets.right,
                    bottom = insets.bottom,
                )
                windowInsets
            }
        }
    }
}
