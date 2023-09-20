package sh.measure.android.exceptions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.tracker.SignalTracker

internal class UnhandledExceptionCollectorTest {

    private var originalDefaultHandler: Thread.UncaughtExceptionHandler? = null
    private val logger = NoopLogger()
    private val timeProvider = FakeTimeProvider()
    private val signalTracker = mock<SignalTracker>()

    @Before
    fun setUp() {
        originalDefaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    }

    @Test
    fun `registers UnhandledExceptionCollector as an uncaught exception handler`() {
        // When
        val collector =
            UnhandledExceptionCollector(logger, signalTracker, timeProvider).apply { register() }
        val currentDefaultHandler = Thread.getDefaultUncaughtExceptionHandler()

        // Then
        assertEquals(collector, currentDefaultHandler)
    }

    @Test
    fun `tracks uncaught exceptions`() {
        val collector =
            UnhandledExceptionCollector(logger, signalTracker, timeProvider).apply { register() }

        // Given
        val thread = Thread.currentThread()
        val exception = RuntimeException("Test exception")
        val expectedException = ExceptionFactory.createMeasureException(
            exception, handled = false, timeProvider.currentTimeSinceEpochInMillis, thread
        )

        // When
        collector.uncaughtException(thread, exception)

        // Then
        verify(signalTracker).trackUnhandledException(
            measureException = expectedException
        )
    }

    @Test
    fun `calls the original handler after capturing the exception`() {
        var originalHandlerCalled = false
        Thread.setDefaultUncaughtExceptionHandler { _, _ ->
            originalHandlerCalled = true
        }
        val collector =
            UnhandledExceptionCollector(logger, signalTracker, timeProvider).apply { register() }

        // Given
        val thread = Thread.currentThread()
        val exception = RuntimeException("Test exception")

        // When
        collector.uncaughtException(thread, exception)

        // Then
        assertTrue(originalHandlerCalled)
    }
}