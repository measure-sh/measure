package sh.measure.android.bugreport

import org.junit.After
import org.junit.Test
import org.mockito.Mockito
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify

class ShakeBugReportCollectorTest {
    private val shakeDetector = mock(ShakeDetector::class.java)
    private val listener = mock(MsrShakeListener::class.java)
    private val collector = ShakeBugReportCollector(shakeDetector)

    @After
    fun tearDown() {
        Mockito.reset(shakeDetector, listener)
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
