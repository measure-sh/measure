package sh.measure.android.utils

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeRandomizer
import java.util.UUID

internal class SamplerImplTest {
    private val configProvider = FakeConfigProvider()
    private val randomizer = FakeRandomizer()
    private val sampler = SamplerImpl(configProvider, randomizer)

    @Before
    fun setup() {
        configProvider.enableFullCollectionMode = false
    }

    @Test
    fun `full collection mode always samples traces`() {
        configProvider.enableFullCollectionMode = true
        configProvider.traceSamplingRate = 0f

        assertTrue(sampler.shouldSampleTrace("0123456789abcdef0123456789abcdef"))
    }

    @Test
    fun `launch event - 0 percent rate never samples`() {
        configProvider.launchSamplingRate = 0f
        assertFalse(sampler.shouldSampleLaunchEvent())
    }

    @Test
    fun `launch event - 100 percent rate always samples`() {
        configProvider.launchSamplingRate = 100f
        assertTrue(sampler.shouldSampleLaunchEvent())
    }

    @Test
    fun `launch event - samples when random is below threshold`() {
        configProvider.launchSamplingRate = 50f
        randomizer.randomDouble = 0.49
        assertTrue(sampler.shouldSampleLaunchEvent())
    }

    @Test
    fun `launch event - does not sample when random is at or above threshold`() {
        configProvider.launchSamplingRate = 50f
        randomizer.randomDouble = 0.50
        assertFalse(sampler.shouldSampleLaunchEvent())
    }

    @Test
    fun `trace - 0 percent rate never samples`() {
        configProvider.traceSamplingRate = 0f
        assertFalse(sampler.shouldSampleTrace("0123456789abcdef0123456789abcdef"))
    }

    @Test
    fun `trace - 100 percent rate always samples`() {
        configProvider.traceSamplingRate = 100f
        assertTrue(sampler.shouldSampleTrace("0123456789abcdef0123456789abcdef"))
    }

    @Test
    fun `trace - same trace id produces consistent sampling decision`() {
        configProvider.traceSamplingRate = 50f
        val traceId = "0123456789abcdef0123456789abcdef"

        val firstResult = sampler.shouldSampleTrace(traceId)
        val secondResult = sampler.shouldSampleTrace(traceId)

        assertTrue(firstResult == secondResult)
    }

    @Test
    fun `journey - 0 percent rate never samples`() {
        configProvider.journeySamplingRate = 0f
        assertFalse(sampler.shouldTrackJourneyForSession(UUID.randomUUID().toString()))
    }

    @Test
    fun `journey - 100 percent rate always samples`() {
        configProvider.journeySamplingRate = 100f
        assertTrue(sampler.shouldTrackJourneyForSession(UUID.randomUUID().toString()))
    }

    @Test
    fun `journey - same session id produces consistent sampling decision`() {
        configProvider.journeySamplingRate = 50f
        val sessionId = "1be7987d-2f06-4dab-b950-18163af2d012"

        val firstResult = sampler.shouldTrackJourneyForSession(sessionId)
        val secondResult = sampler.shouldTrackJourneyForSession(sessionId)

        assertTrue(firstResult == secondResult)
    }

    @Test
    fun `http event - 0 percent rate never samples`() {
        configProvider.httpSamplingRate = 0f
        assertFalse(sampler.shouldSampleHttpEvent())
    }

    @Test
    fun `http event - 100 percent rate always samples`() {
        configProvider.httpSamplingRate = 100f
        assertTrue(sampler.shouldSampleHttpEvent())
    }

    @Test
    fun `http event - samples when random is below threshold`() {
        configProvider.httpSamplingRate = 50f
        randomizer.randomDouble = 0.49
        assertTrue(sampler.shouldSampleHttpEvent())
    }

    @Test
    fun `http event - does not sample when random is at or above threshold`() {
        configProvider.httpSamplingRate = 50f
        randomizer.randomDouble = 0.50
        assertFalse(sampler.shouldSampleHttpEvent())
    }
}
