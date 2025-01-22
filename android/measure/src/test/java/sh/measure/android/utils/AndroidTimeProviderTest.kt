package sh.measure.android.utils

import org.junit.Assert
import org.junit.Test
import java.time.Duration

internal class AndroidTimeProviderTest {
    private val clock: TestClock = TestClock.create(timeInMillis = 0)

    @Test
    fun `now returns time based on clock`() {
        val timeProvider = AndroidTimeProvider(clock)
        Assert.assertEquals(timeProvider.now(), clock.epochTime())
        // increment time
        clock.advance(Duration.ofMillis(1234))
        Assert.assertEquals(timeProvider.now(), 1234L)

        // decrement time
        clock.advance(Duration.ofMillis(-1234))
        Assert.assertEquals(timeProvider.now(), 0L)

        // increment time
        clock.advance(Duration.ofMillis(5678))
        Assert.assertEquals(timeProvider.now(), 5678)
    }

    @Test
    fun `millisTime returns time based on clock`() {
        val timeProvider = AndroidTimeProvider(clock)
        Assert.assertEquals(timeProvider.elapsedRealtime, clock.epochTime())
        // increment time
        clock.advance(Duration.ofMillis(1234))
        Assert.assertEquals(timeProvider.elapsedRealtime, 1234L)

        // decrement time
        clock.advance(Duration.ofMillis(-1234))
        Assert.assertEquals(timeProvider.elapsedRealtime, 0L)

        // increment time
        clock.advance(Duration.ofMillis(5678))
        Assert.assertEquals(timeProvider.elapsedRealtime, 5678)
    }
}
