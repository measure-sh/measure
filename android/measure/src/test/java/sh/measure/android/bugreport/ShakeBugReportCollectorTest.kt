package sh.measure.android.bugreport

import org.junit.After
import org.junit.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify

class ShakeBugReportCollectorTest {
    private val shakeDetector = mock(ShakeDetector::class.java)
    private val listener = mock(MsrShakeListener::class.java)
    private val collector = ShakeBugReportCollector(false, shakeDetector)

    @After
    fun tearDown() {
        Mockito.reset(shakeDetector, listener)
    }

    @Test
    fun `auto launch enabled should start shake detector`() {
        // When
        ShakeBugReportCollector(autoLaunchEnabled = true, shakeDetector)

        // Then
        verify(shakeDetector).start()
    }

    @Test
    fun `enableAutoLaunch should start shake detector`() {
        // When
        collector.enableAutoLaunch(true)

        // Then
        verify(shakeDetector).start()
    }

    @Test
    fun `disableAutoLaunch should stop shake detector`() {
        // Given
        collector.enableAutoLaunch(true)

        // When
        collector.disableAutoLaunch()

        // Then
        verify(shakeDetector).stop()
    }

    @Test
    fun `setShakeListener should not set listener when autoLaunch is enabled`() {
        // Given
        collector.enableAutoLaunch(true)

        // When
        collector.setShakeListener(listener)

        // Then
        // It's called once by enableAutoLaunch
        verify(shakeDetector, times(1)).setShakeListener(any())
    }

    @Test
    fun `setShakeListener should set collector as listener and start when not null`() {
        // When
        collector.setShakeListener(listener)

        // Then
        verify(shakeDetector).setShakeListener(collector)
        verify(shakeDetector).start()
    }

    @Test
    fun `setShakeListener should clear shake detector listener and stop when null`() {
        // Given
        collector.setShakeListener(listener)

        // When
        collector.setShakeListener(null)

        // Then
        verify(shakeDetector).setShakeListener(null)
        verify(shakeDetector).stop()
    }

    @Test
    fun `onShake should forward to listener when autoLaunch is false`() {
        // Given
        collector.setShakeListener(listener)

        // When
        collector.onShake()

        // Then
        verify(listener).onShake()
    }
}
