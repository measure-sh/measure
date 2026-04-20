@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package sh.measure.kmp.crash

import kotlinx.cinterop.invoke
import platform.Foundation.NSException
import platform.Foundation.NSGetUncaughtExceptionHandler

/**
 * Reports an unhandled Kotlin exception to the native crash reporter (KSCrash).
 *
 * The NSException created from the Kotlin Throwable includes "msr_kmp_kotlin_crash"
 * in its userInfo, allowing the iOS SDK to identify this as a Kotlin-originated crash
 * when processing KSCrash reports on the next launch.
 */
internal fun reportUnhandledException(exception: NSException) {
    val handler = NSGetUncaughtExceptionHandler()
    handler?.invoke(exception)
}
