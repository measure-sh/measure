package sh.measure.android.utils

import android.content.Context
import android.content.pm.ApplicationInfo

/**
 * Checks if the host app is debuggable, which is true for debug builds and any build
 * type with `isDebuggable = true`.
 */
internal fun isAppDebuggable(context: Context): Boolean = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
