package sh.measure.android.networkchange

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`

class NetworkStateProviderTest {
    private val initialNetworkStateProvider = mock<InitialNetworkStateProvider>()
    private val networkStateProvider = NetworkStateProviderImpl(initialNetworkStateProvider)

    @Test
    fun `given no network type is available, does not init with network state`() {
        `when`(initialNetworkStateProvider.getNetworkType()).thenReturn(null)
        networkStateProvider.init()

        assertNull(networkStateProvider.getNetworkState())
    }

    @Test
    fun `given network type is available, init with network state`() {
        `when`(initialNetworkStateProvider.getNetworkType()).thenReturn("cellular")
        `when`(initialNetworkStateProvider.getNetworkGeneration("cellular")).thenReturn("4g")
        `when`(initialNetworkStateProvider.getNetworkProvider("cellular")).thenReturn("T-Mobile")
        networkStateProvider.init()

        val networkState = networkStateProvider.getNetworkState()
        assertEquals("cellular", networkState?.networkType)
        assertEquals("4g", networkState?.networkGeneration)
        assertEquals("T-Mobile", networkState?.networkProvider)
    }

    @Test
    fun `network state setter and getter work`() {
        val networkState = NetworkState("cellular", "4g", "T-Mobile")
        networkStateProvider.setNetworkState(networkState)

        assertEquals(networkState, networkStateProvider.getNetworkState())
    }
}
