package sh.measure.kmp

import sh.measure.kmp.nsexception.asNSException
import sh.measure.kmp.nsexception.reportUnhandledException
import sh.measure.kmp.nsexception.wrapUnhandledExceptionHook

/**
 * Sets the unhandled exception hook such that all unhandled Kotlin exceptions
 * are reported to the Measure iOS SDK as fatal crashes.
 *
 * This must be called after [Measure.initialize] so that KSCrash's
 * NSUncaughtExceptionHandler is already installed.
 *
 * If an unhandled exception hook was already set, that hook will be invoked
 * after the exception is reported. Once the exception is reported the program
 * will be terminated.
 */
fun setMeasureUnhandledExceptionHook(): Unit = wrapUnhandledExceptionHook { throwable ->
    reportUnhandledException(throwable.asNSException(appendCausedBy = true))
}
