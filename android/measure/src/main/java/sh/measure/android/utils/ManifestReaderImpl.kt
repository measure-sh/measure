package sh.measure.android.utils

import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.PackageManager.NameNotFoundException
import android.os.Build
import android.os.Bundle
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

internal interface ManifestReader {
    fun load(): ManifestMetadata?
}

internal class ManifestReaderImpl(private val context: Context, private val logger: Logger) :
    ManifestReader {
    private val measureUrlKey = "sh.measure.android.API_URL"
    private val measureApiKey = "sh.measure.android.API_KEY"

    override fun load(): ManifestMetadata? {
        val bundle = try {
            getMetadataBundle()
        } catch (e: NameNotFoundException) {
            logger.log(LogLevel.Error, "Failed to init: unable to read manifest, application not found", e)
            return null
        }
        if (bundle == null) {
            logger.log(LogLevel.Error, "Failed to init: unable to read metadata from manifest")
            return null
        }
        return ManifestMetadata(
            url = bundle.getString(measureUrlKey),
            apiKey = bundle.getString(measureApiKey),
        )
    }

    private fun getMetadataBundle(): Bundle? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.getApplicationInfo(
                context.packageName,
                PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong()),
            ).metaData
        } else {
            context.packageManager.getApplicationInfo(
                context.packageName,
                PackageManager.GET_META_DATA,
            ).metaData
        }
    }
}

internal class ManifestMetadata(
    val url: String?,
    val apiKey: String?,
)
