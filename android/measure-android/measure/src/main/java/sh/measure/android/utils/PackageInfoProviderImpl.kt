package sh.measure.android.utils

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

internal interface PackageInfoProvider {
    val appVersion: String?
    fun getVersionCode(): String
}

internal class PackageInfoProviderImpl(context: Context) : PackageInfoProvider {
    private val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.packageManager.getPackageInfo(
            context.packageName,
            PackageManager.PackageInfoFlags.of(0),
        )
    } else {
        context.packageManager.getPackageInfo(context.packageName, 0)
    }

    override val appVersion = packageInfo.versionName

    override fun getVersionCode(): String = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageInfo.longVersionCode.toString()
    } else {
        packageInfo.versionCode.toString()
    }
}
