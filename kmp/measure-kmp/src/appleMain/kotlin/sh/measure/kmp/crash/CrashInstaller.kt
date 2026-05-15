@file:OptIn(kotlin.experimental.ExperimentalNativeApi::class, ExperimentalStdlibApi::class)

package sh.measure.kmp.crash

import kotlin.native.EagerInitialization
import sh.measure.kmp.nsexception.asNSException

/**
 * Automatically installs the unhandled exception hook when this module is loaded.
 * All unhandled Kotlin exceptions are reported to the Measure iOS SDK as fatal crashes.
 *
 * If an unhandled exception hook was already set, that hook will be invoked
 * after the exception is reported. Once the exception is reported the program
 * will be terminated.
 */
@EagerInitialization
private val installHook: Unit = wrapUnhandledExceptionHook { throwable ->
    reportUnhandledException(throwable.asNSException(appendCausedBy = true))
}
