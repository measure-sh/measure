package sh.measure.android.utils

import android.content.Context
import androidx.core.content.PermissionChecker

internal fun hasPermission(context: Context, permission: String): Boolean {
    return PermissionChecker.checkSelfPermission(
        context,
        permission,
    ) == PermissionChecker.PERMISSION_GRANTED
}
