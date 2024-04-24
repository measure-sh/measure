package sh.measure.android.networkchange

import android.Manifest
import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.telephony.TelephonyManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito
import org.mockito.Mockito.mock
import org.mockito.kotlin.verify
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowNetwork
import org.robolectric.shadows.ShadowNetworkCapabilities
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.SystemServiceProviderImpl

@RunWith(AndroidJUnit4::class)
class NetworkChangesCollectorTest {
    private val logger = NoopLogger()
    private val timeProvider = FakeTimeProvider()
    private val eventProcessor = mock<EventProcessor>()
    private lateinit var systemServiceProvider: SystemServiceProvider
    private lateinit var connectivityManager: ConnectivityManager
    private lateinit var telephonyManager: TelephonyManager
    private lateinit var context: Context

    @Before
    fun setUp() {
        context = RuntimeEnvironment.getApplication()
        systemServiceProvider = SystemServiceProviderImpl(context)
        connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    }

    @Test
    @Config(sdk = [23, 24])
    fun `NetworkChangesCollector does not register network callbacks if permission not available`() {
        shadowOf(context as Application).denyPermissions(Manifest.permission.ACCESS_NETWORK_STATE)

        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        Assert.assertEquals(0, shadowOf(connectivityManager).networkCallbacks.size)
    }

    @Test
    @Config(sdk = [21, 22])
    fun `NetworkChangesCollector does not register network callbacks below API 23`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        Assert.assertEquals(0, shadowOf(connectivityManager).networkCallbacks.size)
    }

    @Test
    @Config(sdk = [23, 24, 26, 28, 29, 30, 31, 33])
    fun `NetworkChangesCollector registers network callbacks when permission is available`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        Assert.assertEquals(1, shadowOf(connectivityManager).networkCallbacks.size)
    }

    @Test
    @Config(sdk = [23, 33])
    fun `NetworkChangesCollector tracks change to cellular network with network_provider and network_generation`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        shadowOf(context as Application).grantPermissions(Manifest.permission.READ_PHONE_STATE)
        shadowOf(telephonyManager).setNetworkOperatorName("Test Provider")
        setNetworkTypeInTelephonyManager(networkType = TelephonyManager.NETWORK_TYPE_NR)
        var previousNetworkType: String? = null

        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // first change is discarded for Android O and above
            triggerNetworkCapabilitiesChange(addTransportType = NetworkCapabilities.TRANSPORT_WIFI)
            previousNetworkType = NetworkType.WIFI
        }
        triggerNetworkCapabilitiesChange(addTransportType = NetworkCapabilities.TRANSPORT_CELLULAR)

        verify(eventProcessor).track(
            type = EventType.NETWORK_CHANGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = NetworkChangeData(
                previous_network_type = previousNetworkType,
                network_type = NetworkType.CELLULAR,
                previous_network_generation = null,
                network_generation = NetworkGeneration.FIFTH_GEN,
                network_provider = "Test Provider",
            ),
        )
    }

    @Test
    @Config(sdk = [23])
    fun `NetworkChangesCollector tracks change to cellular network without network_generation if READ_PHONE_STATE permission is not available`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        shadowOf(telephonyManager).setNetworkOperatorName("Test Provider")
        setNetworkTypeInTelephonyManager(networkType = TelephonyManager.NETWORK_TYPE_NR)

        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        triggerNetworkCapabilitiesChange(addTransportType = NetworkCapabilities.TRANSPORT_CELLULAR)

        verify(eventProcessor).track(
            type = EventType.NETWORK_CHANGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = NetworkChangeData(
                previous_network_type = null,
                network_type = NetworkType.CELLULAR,
                previous_network_generation = null,
                network_generation = null,
                network_provider = "Test Provider",
            ),
        )
    }

    @Test
    @Config(sdk = [33])
    fun `NetworkChangesCollector tracks change to cellular network with network_provider & network_generation if READ_BASIC_PHONE_STATE permission is available`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        shadowOf(context as Application).grantPermissions(Manifest.permission.READ_BASIC_PHONE_STATE)
        shadowOf(telephonyManager).setNetworkOperatorName("Test Provider")
        setNetworkTypeInTelephonyManager(networkType = TelephonyManager.NETWORK_TYPE_NR)

        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            triggerNetworkCapabilitiesChange(addTransportType = NetworkCapabilities.TRANSPORT_WIFI)
        }
        triggerNetworkCapabilitiesChange(addTransportType = NetworkCapabilities.TRANSPORT_CELLULAR)

        verify(eventProcessor).track(
            type = EventType.NETWORK_CHANGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = NetworkChangeData(
                previous_network_type = NetworkType.WIFI,
                network_type = NetworkType.CELLULAR,
                previous_network_generation = null,
                network_generation = NetworkGeneration.FIFTH_GEN,
                network_provider = "Test Provider",
            ),
        )
    }

    @Test
    @Config(sdk = [26, 33])
    fun `NetworkChangesCollector discards first change for SDK 26 and above`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        shadowOf(context as Application).grantPermissions(Manifest.permission.READ_BASIC_PHONE_STATE)
        shadowOf(telephonyManager).setNetworkOperatorName("Test Provider")
        setNetworkTypeInTelephonyManager(networkType = TelephonyManager.NETWORK_TYPE_NR)

        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        triggerNetworkCapabilitiesChange(addTransportType = NetworkCapabilities.TRANSPORT_CELLULAR)

        Mockito.verifyNoInteractions(eventProcessor)
    }

    @Test
    @Config(sdk = [23])
    fun `NetworkChangesCollector tracks change to wifi network`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)

        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        triggerNetworkCapabilitiesChange(addTransportType = NetworkCapabilities.TRANSPORT_WIFI)

        verify(eventProcessor).track(
            type = EventType.NETWORK_CHANGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = NetworkChangeData(
                previous_network_type = null,
                network_type = NetworkType.WIFI,
                previous_network_generation = null,
                network_generation = null,
                network_provider = null,
            ),
        )
    }

    @Test
    fun `NetworkChangesCollector should track network change with new network type and no previous`() {
        // Simulate different previous and new network types
        val previousNetworkType = null
        val newNetworkType = NetworkType.WIFI

        // Simulate the current network generation as null
        val previousNetworkGeneration: String? = null
        val newNetworkGeneration: String? = null

        val collector = NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        )

        val shouldTrackChange = collector.shouldTrackNetworkChange(
            newNetworkType,
            previousNetworkType,
            newNetworkGeneration,
            previousNetworkGeneration,
        )

        // Assert that the change should be tracked
        assertTrue(shouldTrackChange)
    }

    @Test
    fun `NetworkChangesCollector should track network change with different previous and new network type`() {
        // Simulate different previous and new network types
        val previousNetworkType = NetworkType.CELLULAR
        val newNetworkType = NetworkType.WIFI

        // Simulate the current network generation as null
        val previousNetworkGeneration: String? = null
        val newNetworkGeneration: String? = null

        val collector = NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        )

        val shouldTrackChange = collector.shouldTrackNetworkChange(
            newNetworkType,
            previousNetworkType,
            newNetworkGeneration,
            previousNetworkGeneration,
        )

        // Assert that the change should be tracked
        assertTrue(shouldTrackChange)
    }

    @Test
    fun `NetworkChangesCollector should track network change for cellular network when previous gen is not equal to new gen`() {
        // Simulate a previous cellular network type with a different previous and new generation
        val previousNetworkType = NetworkType.CELLULAR
        val newNetworkType = NetworkType.CELLULAR

        // Simulate different previous and new network generations
        val previousNetworkGeneration = "4G"
        val newNetworkGeneration = "5G"

        val collector = NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        )

        val shouldTrackChange = collector.shouldTrackNetworkChange(
            newNetworkType,
            previousNetworkType,
            newNetworkGeneration,
            previousNetworkGeneration,
        )

        // Assert that the change should be tracked as the cellular network generations differ
        assertTrue(shouldTrackChange)
    }

    @Test
    fun `NetworkChangesCollector should not track network change for same network type and generation`() {
        // Simulate a cellular network type with the same previous and new generation
        val previousNetworkType = NetworkType.CELLULAR
        val newNetworkType = NetworkType.CELLULAR

        // Simulate the same previous and new network generations
        val previousNetworkGeneration = "4G"
        val newNetworkGeneration = "4G"

        val collector = NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        )

        val shouldTrackChange = collector.shouldTrackNetworkChange(
            newNetworkType,
            previousNetworkType,
            newNetworkGeneration,
            previousNetworkGeneration,
        )

        // Assert that the change should not be tracked as the network type and generation are the same
        Assert.assertFalse(shouldTrackChange)
    }

    @Test
    @Config(sdk = [23])
    fun `NetworkChangesCollector tracks change to VPN network`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)

        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        triggerNetworkCapabilitiesChange(addTransportType = NetworkCapabilities.TRANSPORT_VPN)

        verify(eventProcessor).track(
            type = EventType.NETWORK_CHANGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = NetworkChangeData(
                previous_network_type = null,
                network_type = NetworkType.VPN,
                previous_network_generation = null,
                network_generation = null,
                network_provider = null,
            ),
        )
    }

    @Test
    @Config(sdk = [23])
    fun `NetworkChangesCollector tracks network change event when network is lost`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)

        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        val networkCallback = shadowOf(connectivityManager).networkCallbacks.first()
        val network = ShadowNetwork.newInstance(789)
        networkCallback.onLost(network)

        verify(eventProcessor).track(
            type = EventType.NETWORK_CHANGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = NetworkChangeData(
                previous_network_type = null,
                network_type = NetworkType.NO_NETWORK,
                previous_network_generation = null,
                network_generation = null,
                network_provider = null,
            ),
        )
    }

    @Test
    @Config(sdk = [23])
    fun `NetworkChangesCollector discards first change with previous network when network is lost`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        shadowOf(context as Application).grantPermissions(Manifest.permission.READ_PHONE_STATE)
        shadowOf(telephonyManager).setNetworkOperatorName("Test Provider")
        setNetworkTypeInTelephonyManager(networkType = TelephonyManager.NETWORK_TYPE_NR)

        NetworkChangesCollector(
            context = context,
            logger = logger,
            eventProcessor = eventProcessor,
            timeProvider = timeProvider,
            systemServiceProvider = systemServiceProvider,
        ).register()

        triggerNetworkCapabilitiesChange(addTransportType = NetworkCapabilities.TRANSPORT_CELLULAR)
        val networkCallback = shadowOf(connectivityManager).networkCallbacks.first()
        val network = ShadowNetwork.newInstance(789)
        networkCallback.onLost(network)

        verify(eventProcessor).track(
            type = EventType.NETWORK_CHANGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = NetworkChangeData(
                previous_network_type = null,
                network_type = NetworkType.CELLULAR,
                previous_network_generation = null,
                network_generation = NetworkGeneration.FIFTH_GEN,
                network_provider = "Test Provider",
            ),
        )
    }

    private fun triggerNetworkCapabilitiesChange(
        addTransportType: Int,
        removeTransportType: Int? = null,
    ) {
        val networkCallback = shadowOf(connectivityManager).networkCallbacks.first()
        val network = ShadowNetwork.newInstance(789)
        val capabilities = ShadowNetworkCapabilities.newInstance()
        if (removeTransportType != null) {
            shadowOf(capabilities).removeTransportType(removeTransportType)
        }
        shadowOf(capabilities).addTransportType(addTransportType)
        networkCallback.onCapabilitiesChanged(network, capabilities)
    }

    @Suppress("SameParameterValue")
    private fun setNetworkTypeInTelephonyManager(networkType: Int = TelephonyManager.NETWORK_TYPE_NR) {
        shadowOf(telephonyManager).setDataNetworkType(networkType)
        @Suppress("DEPRECATION") // Required for APIs below Android N
        shadowOf(telephonyManager).setNetworkType(networkType)
    }
}
