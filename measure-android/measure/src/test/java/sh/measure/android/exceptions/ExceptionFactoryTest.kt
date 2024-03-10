package sh.measure.android.exceptions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import sh.measure.android.fakes.FakeTimeProvider

class ExceptionFactoryTest {

    private val timeProvider = FakeTimeProvider()

    @Test
    fun `ExceptionFactory creates a single exception when exception has no cause`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception,
            handled = true,
            timeProvider.currentTimeSinceEpochInMillis,
            thread = thread,
            networkType = null,
            networkGeneration = null,
            networkProvider = null,
            foreground = true,
            deviceLocale = "en-US",
        )

        // Then
        val exceptionUnits = measureException.exceptions
        assertEquals(1, exceptionUnits.size)

        val exceptionUnit = exceptionUnits[0]
        assertEquals("java.lang.IllegalArgumentException", exceptionUnit.type)
        assertEquals("Test exception", exceptionUnit.message)
        assertTrue(exceptionUnit.frames.isNotEmpty())
    }

    @Test
    fun `ExceptionFactory creates two exceptions when exception has a cause`() {
        // Given
        val exception =
            IllegalArgumentException("Test exception").initCause(RuntimeException("Cause"))
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception,
            handled = true,
            timeProvider.currentTimeSinceEpochInMillis,
            thread = thread,
            networkType = null,
            networkGeneration = null,
            networkProvider = null,
            foreground = true,
            deviceLocale = "en-US",
        )

        // Then
        val exceptions = measureException.exceptions
        assertEquals(2, exceptions.size)

        val exceptionUnit = exceptions[0]
        assertEquals("java.lang.IllegalArgumentException", exceptionUnit.type)
        assertEquals("Test exception", exceptionUnit.message)
        assertTrue(exceptionUnit.frames.isNotEmpty())

        val causeException = exceptions[1]
        assertEquals("java.lang.RuntimeException", causeException.type)
        assertEquals("Cause", causeException.message)
        assertTrue(causeException.frames.isNotEmpty())
    }

    @Test
    fun `ExceptionFactory sets handled to true when the exception is handled`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception,
            handled = true,
            timeProvider.currentTimeSinceEpochInMillis,
            thread = thread,
            networkType = null,
            networkGeneration = null,
            networkProvider = null,
            foreground = true,
            deviceLocale = "en-US",
        )

        // Then
        assertTrue(measureException.handled)
    }

    @Test
    fun `ExceptionFactory sets handled to false when the exception is unhandled`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception,
            handled = false,
            timeProvider.currentTimeSinceEpochInMillis,
            thread = thread,
            networkType = null,
            networkGeneration = null,
            networkProvider = null,
            foreground = true,
            deviceLocale = "en-US",
        )

        // Then
        assertFalse(measureException.handled)
    }

    @Test
    fun `ExceptionFactory sets network info`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception,
            handled = false,
            timeProvider.currentTimeSinceEpochInMillis,
            thread = thread,
            networkType = "network_type",
            networkGeneration = "network_gen",
            networkProvider = "network_provider",
            foreground = true,
            deviceLocale = "en-US",
        )

        // Then
        assertEquals("network_type", measureException.network_type)
        assertEquals("network_gen", measureException.network_generation)
        assertEquals("network_provider", measureException.network_provider)
    }
}
