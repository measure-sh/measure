package sh.measure.sample.exceptions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.verify
import sh.measure.sample.MeasureClient

internal class UnhandledExceptionCollectorTest {

    private val client = mock<MeasureClient>()
    private var originalDefaultHandler: Thread.UncaughtExceptionHandler? = null

    @Before
    fun setUp() {
        originalDefaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    }

    @Test
    fun `registers UnhandledExceptionCollector as an uncaught exception handler`() {
        // When
        val collector = UnhandledExceptionCollector(client).apply { register() }
        val currentDefaultHandler = Thread.getDefaultUncaughtExceptionHandler()

        // Then
        assertEquals(collector, currentDefaultHandler)
    }

    @Test
    fun `parses uncaught exceptions, parses it into ExceptionData and reports it to MeasureClient`() {
        val collector = UnhandledExceptionCollector(client).apply { register() }

        // Given
        val thread = Thread.currentThread()
        val exception = RuntimeException("Test exception")
        val expectedExceptionData = ExceptionFactory.createExceptionData(exception, handled = false)

        // When
        collector.uncaughtException(thread, exception)

        // Then
        verify(client).captureException(expectedExceptionData)
    }

    @Test
    fun `calls the original handler after capturing the exception`() {
        var originalHandlerCalled = false
        Thread.setDefaultUncaughtExceptionHandler { _, _ ->
            originalHandlerCalled = true
        }
        val collector = UnhandledExceptionCollector(client).apply { register() }

        // Given
        val thread = Thread.currentThread()
        val exception = RuntimeException("Test exception")

        // When
        collector.uncaughtException(thread, exception)

        // Then
        assertTrue(originalHandlerCalled)
    }
}