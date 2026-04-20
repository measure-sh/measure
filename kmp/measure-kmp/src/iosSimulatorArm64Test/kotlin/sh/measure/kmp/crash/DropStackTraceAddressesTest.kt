package sh.measure.kmp.crash

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DropStackTraceAddressesTest {

    // Realistic Kotlin/Native stack trace for RuntimeException("test").
    // Ordered innermost to outermost: Throwable init first, then call site.
    private val className = "kotlin.RuntimeException"
    private val stackTrace = arrayOf(
        "kfun:kotlin.Throwable#<init>(kotlin.String?){}",
        "kfun:kotlin.Exception#<init>(kotlin.String?){}",
        "kfun:kotlin.RuntimeException#<init>(kotlin.String){}",
        "kfun:com.example.MyClass#doSomething(){}",
        "kfun:com.example.AppKt#main(){}",
    )

    // Placeholder addresses — dropInitAddresses only uses stackTrace strings to decide
    // what to drop; address values are irrelevant for these tests.
    private val addresses = List(stackTrace.size) { it.toLong() }

    @Test
    fun `dropInitAddresses removes target init frames from filtered result`() {
        val initPattern = "kfun:$className#<init>"

        val filtered = addresses.dropInitAddresses(className, stackTrace)

        assertTrue(filtered.size < addresses.size)
        val keptFrames = stackTrace.takeLast(filtered.size)
        assertTrue(keptFrames.none { it.contains(initPattern) })
    }

    @Test
    fun `dropInitAddresses keeps last init frame when keepLast is true`() {
        val initPattern = "kfun:$className#<init>"

        val filtered = addresses.dropInitAddresses(className, stackTrace, keepLast = false)
        val filteredKeepLast = addresses.dropInitAddresses(className, stackTrace, keepLast = true)

        assertEquals(filtered.size + 1, filteredKeepLast.size)
        val extraFrameIndex = addresses.size - filteredKeepLast.size
        assertTrue(stackTrace[extraFrameIndex].contains(initPattern))
    }

    @Test
    fun `dropInitAddresses returns list unchanged when no matching init frames`() {
        val filtered = addresses.dropInitAddresses(
            qualifiedClassName = "com.nonexistent.FakeClass",
            stackTrace = stackTrace,
        )
        assertEquals(addresses, filtered)
    }

    @Test
    fun `dropCommonAddresses returns all when commonAddresses is empty`() {
        assertEquals(addresses, addresses.dropCommonAddresses(emptyList()))
    }

    @Test
    fun `dropCommonAddresses drops matching tail addresses`() {
        val commonTail = listOf(0x4000L, 0x5000L, 0x6000L)
        val addresses1 = listOf(0x1000L, 0x2000L) + commonTail
        val addresses2 = listOf(0x3000L) + commonTail

        val result = addresses1.dropCommonAddresses(addresses2)

        assertEquals(listOf(0x1000L, 0x2000L), result)
    }

    @Test
    fun `dropCommonAddresses returns original when no common tail`() {
        val addresses1 = listOf(0x1000L, 0x2000L, 0x3000L)
        val nonCommon = listOf(-1L, -2L, -3L)

        assertEquals(addresses1, addresses1.dropCommonAddresses(nonCommon))
    }
}
