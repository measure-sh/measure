package sh.measure.android.events

import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.verify
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.navigation.NavigationData
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TimeProvider

class UserTriggeredEventCollectorImplTest {
    private val eventProcessor: EventProcessor = mock()
    private val timeProvider: TimeProvider = FakeTimeProvider()
    private val processInfoProvider: ProcessInfoProvider = FakeProcessInfoProvider()

    private val userTriggeredEventCollector = UserTriggeredEventCollectorImpl(
        eventProcessor, timeProvider, processInfoProvider
    )


    @Test
    fun `tracks navigation event`() {
        val from = "from"
        val to = "to"
        userTriggeredEventCollector.trackNavigation(to, from)
        verify(eventProcessor).trackUserTriggered(
            data = NavigationData(
                source = null,
                from = from,
                to = to,
            ), type = EventType.NAVIGATION, timestamp = timeProvider.currentTimeSinceEpochInMillis
        )
    }

    @Test
    fun `tracks handled exception event`() {
        val exception = Exception()
        val data = FakeEventFactory.getExceptionData(handled = true, exception = exception)

        userTriggeredEventCollector.trackHandledException(exception)
        verify(eventProcessor).trackUserTriggered(
            data = data,
            type = EventType.EXCEPTION,
            timestamp = timeProvider.currentTimeSinceEpochInMillis
        )
    }
}