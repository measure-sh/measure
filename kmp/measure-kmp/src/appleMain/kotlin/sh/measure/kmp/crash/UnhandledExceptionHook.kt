// https://github.com/rickclephas/NSExceptionKt/blob/master/nsexception-kt-core/src/commonMain/kotlin/com/rickclephas/kmp/nsexceptionkt/core/UnhandledExceptionHook.kt
//
// Copyright (c) 2022 Rick Clephas
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

package sh.measure.kmp.crash

import kotlin.concurrent.AtomicReference
import kotlin.experimental.ExperimentalNativeApi

/**
 * Wraps the unhandled exception hook such that the provided [hook] is invoked
 * before the currently set unhandled exception hook is invoked.
 * Note: once the unhandled exception hook returns the program will be terminated.
 * @see setUnhandledExceptionHook
 * @see terminateWithUnhandledException
 */
@OptIn(ExperimentalNativeApi::class)
internal fun wrapUnhandledExceptionHook(hook: (Throwable) -> Unit) {
    // Late-bind the previous hook: the wrapped closure has to reference it,
    // but we don't know what it is until we install ourselves.
    val previousHookRef = AtomicReference<ReportUnhandledExceptionHook?>(null)
    val wrappedHook: ReportUnhandledExceptionHook = { throwable ->
        hook(throwable)
        previousHookRef.value?.invoke(throwable)
        terminateWithUnhandledException(throwable)
    }
    previousHookRef.value = setUnhandledExceptionHook(wrappedHook)
}
