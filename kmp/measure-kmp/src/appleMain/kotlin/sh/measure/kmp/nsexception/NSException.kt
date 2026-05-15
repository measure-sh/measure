// https://github.com/rickclephas/NSExceptionKt/blob/master/nsexception-kt-core/src/commonMain/kotlin/com/rickclephas/kmp/nsexceptionkt/core/NSException.kt
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

package sh.measure.kmp.nsexception

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.convert
import platform.Foundation.NSError
import platform.Foundation.NSException
import platform.Foundation.NSLocalizedDescriptionKey
import platform.Foundation.NSNumber
import platform.darwin.NSUInteger
import sh.measure.kmp.crash.causes
import sh.measure.kmp.crash.getFilteredStackTraceAddresses
import kotlin.reflect.KClass

private const val kotlinCrashMarker = "msr_kmp_kotlin_crash"

/**
 * Returns a [NSException] representing `this` [Throwable].
 * If [appendCausedBy] is `true` then the name, message and stack trace
 * of the [causes][Throwable.cause] will be appended, else causes are ignored.
 */
@OptIn(ExperimentalForeignApi::class)
internal fun Throwable.asNSException(appendCausedBy: Boolean = false): NSException {
    val returnAddresses = getFilteredStackTraceAddresses().let { addresses ->
        if (!appendCausedBy) return@let addresses
        addresses.toMutableList().apply {
            for (cause in causes) {
                addAll(cause.getFilteredStackTraceAddresses(true, addresses))
            }
        }
    }.map {
        NSNumber(unsignedInteger = it.convert<NSUInteger>())
    }
    return ThrowableNSException(name, getReason(appendCausedBy), returnAddresses)
}

/**
 * Returns the [qualifiedName][KClass.qualifiedName] or [simpleName][KClass.simpleName] of `this` throwable.
 * If both are `null` then "Throwable" is returned.
 */
internal val Throwable.name: String
    get() = this::class.qualifiedName ?: this::class.simpleName ?: "Throwable"

/**
 * Returns the [message][Throwable.message] of this throwable.
 * If [appendCausedBy] is `true` then caused by lines with the format
 * "Caused by: $[name]: $[message][Throwable.message]" will be appended.
 */
internal fun Throwable.getReason(appendCausedBy: Boolean = false): String? {
    if (!appendCausedBy) return message
    return buildString {
        message?.let(::append)
        for (cause in causes) {
            if (isNotEmpty()) appendLine()
            append("Caused by: ")
            append(cause.name)
            cause.message?.let { append(": $it") }
        }
    }.takeIf { it.isNotEmpty() }
}

internal class ThrowableNSException(
    name: String,
    reason: String?,
    private val returnAddresses: List<NSNumber>
) : NSException(name, reason, mapOf(kotlinCrashMarker to true)) {
    override fun callStackReturnAddresses(): List<NSNumber> = returnAddresses
}

/**
 * Returns an [NSError] representing `this` [Throwable], for ObjC APIs that take a Swift `Error?`
 * (which bridges to `NSError * _Nullable`).
 */
internal fun Throwable.asNSError(): NSError = NSError.errorWithDomain(
    domain = name,
    code = 0,
    userInfo = message?.let { mapOf<Any?, Any>(NSLocalizedDescriptionKey to it) },
)
