package sh.measure.kmp.nsexception

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GetReasonTest {

    @Test
    fun `returns null when message is null`() {
        val throwable = RuntimeException(null as String?)
        assertNull(throwable.getReason())
    }

    @Test
    fun `returns message when no causes`() {
        val throwable = RuntimeException("something went wrong")
        assertEquals("something went wrong", throwable.getReason())
    }

    @Test
    fun `appendCausedBy appends single cause with message`() {
        val cause = RuntimeException("root cause")
        val throwable = RuntimeException("top level", cause)

        val reason = throwable.getReason(appendCausedBy = true)

        assertEquals("top level\nCaused by: kotlin.RuntimeException: root cause", reason)
    }

    @Test
    fun `appendCausedBy single cause with null message has no colon suffix`() {
        val cause = RuntimeException(null as String?)
        val throwable = RuntimeException("top level", cause)

        val reason = throwable.getReason(appendCausedBy = true)!!

        assertTrue(reason.contains("Caused by: kotlin.RuntimeException"))
        assertFalse(reason.contains("Caused by: kotlin.RuntimeException:"))
    }

    @Test
    fun `appendCausedBy appends chained causes in order`() {
        val root = RuntimeException("root")
        val middle = RuntimeException("middle", root)
        val top = RuntimeException("top", middle)

        val reason = top.getReason(appendCausedBy = true)!!
        val lines = reason.lines()

        assertEquals("top", lines[0])
        assertTrue(lines[1].contains("middle"))
        assertTrue(lines[2].contains("root"))
    }

    @Test
    fun `appendCausedBy returns null when message is null and no causes`() {
        val throwable = RuntimeException(null as String?)
        assertNull(throwable.getReason(appendCausedBy = true))
    }
}
