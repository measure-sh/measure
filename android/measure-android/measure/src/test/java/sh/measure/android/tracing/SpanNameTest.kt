package sh.measure.android.tracing

import org.junit.Assert.assertEquals
import org.junit.Test

class SpanNameTest {

    @Test
    fun `activityTtidSpan returns full string when within max length`() {
        // Given
        val className = "com.example.MyActivity"
        val maxLength = 50

        // When
        val result = SpanName.activityTtidSpan(className, maxLength)

        // Then
        assertEquals("Activity TTID com.example.MyActivity", result)
    }

    @Test
    fun `activityTtidSpan truncates class name when over max length`() {
        // Given
        val className = "com.example.very.long.package.name.MyActivity"
        val maxLength = 25

        // When
        val result = SpanName.activityTtidSpan(className, maxLength)

        // Then
        // "Activity TTID " is 14 characters
        // So we can fit 11 more characters (25 - 14)
        assertEquals("Activity TTID .MyActivity", result)
    }

    @Test
    fun `fragmentTtidSpan returns full string when under max length`() {
        // Given
        val className = "com.example.MyFragment"
        val maxLength = 50

        // When
        val result = SpanName.fragmentTtidSpan(className, maxLength)

        // Then
        assertEquals("Fragment TTID com.example.MyFragment", result)
    }

    @Test
    fun `fragmentTtidSpan truncates class name when over max length`() {
        // Given
        val className = "com.example.very.long.package.name.MyFragment"
        val maxLength = 26

        // When
        val result = SpanName.fragmentTtidSpan(className, maxLength)

        // Then
        // "Fragment TTID " is 14 characters
        // So we can fit 12 more characters (26 - 14)
        assertEquals("Fragment TTID e.MyFragment", result)
    }

    @Test
    fun `activityTtidSpan handles exact length match`() {
        // Given
        val className = "MyActivity"
        val maxLength = 24 // Exact length of "Activity TTID MyActivity"

        // When
        val result = SpanName.activityTtidSpan(className, maxLength)

        // Then
        assertEquals("Activity TTID MyActivity", result)
    }

    @Test
    fun `fragmentTtidSpan handles exact length match`() {
        // Given
        val className = "MyFragment"
        val maxLength = 24 // Exact length of "Fragment TTID MyFragment"

        // When
        val result = SpanName.fragmentTtidSpan(className, maxLength)

        // Then
        assertEquals("Fragment TTID MyFragment", result)
    }

    @Test
    fun `activityTtidSpan handles empty class name`() {
        // Given
        val className = ""
        val maxLength = 50

        // When
        val result = SpanName.activityTtidSpan(className, maxLength)

        // Then
        assertEquals("Activity TTID ", result)
    }

    @Test
    fun `fragmentTtidSpan handles empty class name`() {
        // Given
        val className = ""
        val maxLength = 50

        // When
        val result = SpanName.fragmentTtidSpan(className, maxLength)

        // Then
        assertEquals("Fragment TTID ", result)
    }
}
