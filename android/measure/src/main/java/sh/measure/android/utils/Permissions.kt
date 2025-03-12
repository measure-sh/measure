package sh.measure.android.utils

import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.PermissionChecker

internal fun hasPermission(context: Context, permission: String): Boolean {
    return PermissionChecker.checkSelfPermission(
        context,
        permission,
    ) == PermissionChecker.PERMISSION_GRANTED
}

/**
 * Checks if the [permission] is declared in the manifest.
 */
internal fun isPermissionDeclared(context: Context, permission: String): Boolean {
    return try {
        val packageInfo = context.packageManager.getPackageInfo(
            context.packageName,
            PackageManager.GET_PERMISSIONS,
        )
        packageInfo.requestedPermissions?.contains(permission) ?: false
    } catch (e: PackageManager.NameNotFoundException) {
        false
    }
}
