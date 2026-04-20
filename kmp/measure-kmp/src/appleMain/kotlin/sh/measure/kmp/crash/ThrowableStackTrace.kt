// https://github.com/rickclephas/NSExceptionKt/blob/master/nsexception-kt-core/src/commonMain/kotlin/com/rickclephas/kmp/nsexceptionkt/core/Throwable.kt
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

@file:OptIn(kotlin.experimental.ExperimentalNativeApi::class)

package sh.measure.kmp.crash

/**
 * Returns a list with all the [causes][Throwable.cause].
 * The first element will be the cause, the second the cause of the cause, etc.
 * This function stops once a reference cycles is detected.
 */
internal val Throwable.causes: List<Throwable> get() = buildList {
    val causes = mutableSetOf<Throwable>()
    var cause = cause
    while (cause != null && causes.add(cause)) {
        add(cause)
        cause = cause.cause
    }
}

/**
 * Returns a list of stack trace addresses representing
 * the stack trace of the constructor call to `this` [Throwable].
 * @param keepLastInit `true` to preserve the last constructor call, `false` to drop all constructor calls.
 * @param commonAddresses a list of addresses used to drop the last common addresses.
 * @see getStackTraceAddresses
 */
internal fun Throwable.getFilteredStackTraceAddresses(
    keepLastInit: Boolean = false,
    commonAddresses: List<Long> = emptyList()
): List<Long> = getStackTraceAddresses().dropInitAddresses(
    qualifiedClassName = this::class.qualifiedName ?: Throwable::class.qualifiedName!!,
    stackTrace = getStackTrace(),
    keepLast = keepLastInit
).dropCommonAddresses(commonAddresses)

/**
 * Returns a list containing all addresses expect for the first addresses
 * matching the constructor call of the [qualifiedClassName].
 * If [keepLast] is `true` the last constructor call won't be dropped.
 */
internal fun List<Long>.dropInitAddresses(
    qualifiedClassName: String,
    stackTrace: Array<String>,
    keepLast: Boolean = false
): List<Long> {
    val exceptionInit = "kfun:$qualifiedClassName#<init>"
    var dropCount = 0
    var foundInit = false
    for (i in stackTrace.indices) {
        if (stackTrace[i].contains(exceptionInit)) {
            foundInit = true
        } else if (foundInit) {
            dropCount = i
            break
        }
    }
    if (keepLast) dropCount--
    return drop(kotlin.math.max(0, dropCount))
}

/**
 * Returns a list containing all addresses expect for the last addresses that match with the [commonAddresses].
 */
internal fun List<Long>.dropCommonAddresses(
    commonAddresses: List<Long>
): List<Long> {
    var i = commonAddresses.size
    if (i == 0) return this

    return dropLastWhile {
        i-- > 0 && commonAddresses[i] == it
    }
}
