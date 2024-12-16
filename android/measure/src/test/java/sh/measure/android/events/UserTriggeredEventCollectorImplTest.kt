package sh.measure.android.events

import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.TestData
import sh.measure.android.navigation.NavigationData
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TestClock

class UserTriggeredEventCollectorImplTest {
    private val signalProcessor: SignalProcessor = mock()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val processInfoProvider: ProcessInfoProvider = FakeProcessInfoProvider()

    private val userTriggeredEventCollector = UserTriggeredEventCollectorImpl(
        signalProcessor,
        timeProvider,
        processInfoProvider,
    )

    @Test
    fun `tracks navigation event`() {
        val from = "from"
        val to = "to"
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackNavigation(to, from)
        verify(signalProcessor).trackUserTriggered(
            data = NavigationData(
                source = null,
                from = from,
                to = to,
            ),
            type = EventType.NAVIGATION,
            timestamp = timeProvider.now(),
        )
    }

    @Test
    fun `tracks handled exception event`() {
        val exception = Exception()
        val data = TestData.getExceptionData(handled = true, exception = exception)

        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHandledException(exception)
        verify(signalProcessor).trackUserTriggered(
            data = data,
            type = EventType.EXCEPTION,
            timestamp = timeProvider.now(),
        )
    }

    @Test
    fun `disables collection un unregistered`() {
        val exception = Exception()
        val data = TestData.getExceptionData(handled = true, exception = exception)

        userTriggeredEventCollector.unregister()
        userTriggeredEventCollector.trackHandledException(exception)
        verify(signalProcessor, never()).trackUserTriggered(
            any<ExceptionData>(),
            any(),
            any(),
        )
    }
}
