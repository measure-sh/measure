package sh.measure.android.events

import org.junit.Assert
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import sh.measure.android.attributes.StringAttr
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TestClock

class UserTriggeredEventCollectorImplTest {
    private val logger = NoopLogger()
    private val signalProcessor: SignalProcessor = mock()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val processInfoProvider: ProcessInfoProvider = FakeProcessInfoProvider()
    private val configProvider = FakeConfigProvider()

    private val userTriggeredEventCollector = UserTriggeredEventCollectorImpl(
        logger,
        signalProcessor,
        timeProvider,
        processInfoProvider,
        configProvider,
    )

    @Test
    fun `tracks screen view event`() {
        val screenName = "screen-name"
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackScreenView(screenName, emptyMap())
        verify(signalProcessor).trackUserTriggered(
            data = ScreenViewData(name = screenName),
            type = EventType.SCREEN_VIEW,
            timestamp = timeProvider.now(),
        )
    }

    @Test
    fun `tracks screen view event with user-defined attributes`() {
        val screenName = "screen-name"
        val attributes = mapOf("key" to StringAttr("value"))
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackScreenView(screenName, attributes)
        verify(signalProcessor).trackUserTriggered(
            data = ScreenViewData(name = screenName),
            type = EventType.SCREEN_VIEW,
            timestamp = timeProvider.now(),
            userDefinedAttributes = attributes,
        )
    }

    @Test
    fun `tracks handled exception event`() {
        val exception = Exception()

        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHandledException(exception)
        verify(signalProcessor).trackUserTriggered(
            data = any<ExceptionData>(),
            timestamp = eq(timeProvider.now()),
            type = eq(EventType.EXCEPTION),
            attachments = eq(mutableListOf()),
            userDefinedAttributes = eq(mutableMapOf()),
        )
    }

    @Test
    fun `tracks bug report event with attachments`() {
        val data = TestData.getBugReportData()
        val screenshot = TestData.getMsrAttachment()
        val attachmentsCaptor = argumentCaptor<MutableList<Attachment>>()

        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackBugReport(
            data.description,
            screenshots = listOf(screenshot),
            attributes = mutableMapOf(),
        )
        verify(signalProcessor).trackUserTriggered(
            data = eq(data),
            timestamp = eq(timeProvider.now()),
            type = eq(EventType.BUG_REPORT),
            attachments = attachmentsCaptor.capture(),
            userDefinedAttributes = any(),
        )
        Assert.assertEquals(1, attachmentsCaptor.firstValue.size)
    }

    @Test
    fun `tracks bug report event with no attachments`() {
        val data = TestData.getBugReportData()

        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackBugReport(
            data.description,
            screenshots = listOf(),
            attributes = mutableMapOf(),
        )
        verify(signalProcessor).trackUserTriggered(
            data = data,
            timestamp = timeProvider.now(),
            type = EventType.BUG_REPORT,
            attachments = mutableListOf(),
        )
    }

    @Test
    fun `disables collection on unregistered`() {
        val exception = Exception()
        userTriggeredEventCollector.unregister()
        userTriggeredEventCollector.trackHandledException(exception)
        verify(signalProcessor, never()).trackUserTriggered(
            any<ExceptionData>(),
            any(),
            any(),
            any(),
            any(),
        )
    }
}
