package sh.measure.android.anr

import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.verify
import sh.measure.android.events.EventProcessor
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.fakes.FakeLocaleProvider
import sh.measure.android.fakes.FakeNetworkInfoProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.SystemServiceProvider

class AnrCollectorTest {
    private val logger = NoopLogger()
    private val timeProvider = FakeTimeProvider()
    private val networkInfoProvider = FakeNetworkInfoProvider()
    private val localeProvider = FakeLocaleProvider()
    private val eventProcessor = mock<EventProcessor>()
    private val systemServiceProvider = mock<SystemServiceProvider>()

    @Test
    fun `AnrCollector tracks exception using event tracker, when ANR is detected`() {
        val anrCollector = AnrCollector(logger, systemServiceProvider, networkInfoProvider, timeProvider, eventProcessor, localeProvider)
        val thread = Thread.currentThread()
        val message = "ANR"
        val timestamp = timeProvider.currentTimeSinceEpochInMillis
        val anrError = AnrError(thread, timestamp, message)

        // When
        anrCollector.onAppNotResponding(anrError)

        // Then
        verify(eventProcessor).trackAnr(
            ExceptionFactory.createMeasureException(
                throwable = anrError,
                handled = false,
                timestamp = anrError.timestamp,
                thread = thread,
                networkType = networkInfoProvider.getNetworkType(),
                networkGeneration = networkInfoProvider.getNetworkGeneration(networkInfoProvider.getNetworkType()),
                networkProvider = networkInfoProvider.getNetworkProvider(networkInfoProvider.getNetworkType()),
                deviceLocale = localeProvider.getLocale(),
                foreground = false,
                isAnr = true,
            ),
        )
    }
}
