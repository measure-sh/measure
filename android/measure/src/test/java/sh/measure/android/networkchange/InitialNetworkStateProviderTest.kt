package sh.measure.android.networkchange

import android.Manifest
import android.app.Application
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.NetworkInfo
import android.os.Build
import android.telephony.TelephonyManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Ignore
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowNetwork
import org.robolectric.shadows.ShadowNetworkCapabilities
import org.robolectric.shadows.ShadowNetworkInfo
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.SystemServiceProviderImpl

@RunWith(AndroidJUnit4::class)
internal class InitialNetworkStateProviderTest {

    private val logger = NoopLogger()
    private val context = RuntimeEnvironment.getApplication()
    private val systemServiceProvider = SystemServiceProviderImpl(context)

    @Test
    fun `returns null network generation for non cellular networks`() {
        val networkGeneration = InitialNetworkStateProviderImpl(
            context = context,
            logger = logger,
            systemServiceProvider = systemServiceProvider,
        ).getNetworkGeneration(NetworkType.WIFI)

        assertNull(networkGeneration)
    }

    @Test
    fun `returns correct network generation with permission`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.READ_PHONE_STATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            shadowOf(systemServiceProvider.telephonyManager).setDataNetworkType(TelephonyManager.NETWORK_TYPE_LTE)
        } else {
            shadowOf(systemServiceProvider.telephonyManager).setNetworkType(TelephonyManager.NETWORK_TYPE_LTE)
        }

        val networkGeneration = InitialNetworkStateProviderImpl(
            context = context,
            logger = logger,
            systemServiceProvider = systemServiceProvider,
        ).getNetworkGeneration(NetworkType.CELLULAR)

        assertEquals(NetworkGeneration.FOURTH_GEN, networkGeneration)
    }

    @Test
    fun `returns null network generation without permission`() {
        shadowOf(context as Application).denyPermissions(Manifest.permission.READ_PHONE_STATE)
        shadowOf(systemServiceProvider.telephonyManager).setNetworkType(TelephonyManager.NETWORK_TYPE_LTE)

        val networkGeneration = InitialNetworkStateProviderImpl(
            context = context,
            logger = logger,
            systemServiceProvider = systemServiceProvider,
        ).getNetworkGeneration(NetworkType.CELLULAR)

        assertNull(networkGeneration)
    }

    @Test
    fun `returns null network provider for non cellular networks`() {
        val networkProvider = InitialNetworkStateProviderImpl(
            context = context,
            logger = logger,
            systemServiceProvider = systemServiceProvider,
        ).getNetworkProvider(NetworkType.WIFI)

        assertNull(networkProvider)
    }

    @Test
    fun `returns null network provider for blank network operator name`() {
        shadowOf(systemServiceProvider.telephonyManager).setNetworkOperatorName("")
        val networkProvider = InitialNetworkStateProviderImpl(
            context = context,
            logger = logger,
            systemServiceProvider = systemServiceProvider,
        ).getNetworkProvider(NetworkType.CELLULAR)

        assertNull(networkProvider)
    }

    @Test
    fun `returns correct network provider`() {
        shadowOf(systemServiceProvider.telephonyManager).setNetworkOperatorName("test_provider")
        val networkProvider = InitialNetworkStateProviderImpl(
            context = context,
            logger = logger,
            systemServiceProvider = systemServiceProvider,
        ).getNetworkProvider(NetworkType.CELLULAR)

        assertEquals("test_provider", networkProvider)
    }

    @Test
    fun `returns null network type without network state permission`() {
        shadowOf(context as Application).denyPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        val networkType = InitialNetworkStateProviderImpl(
            context = context,
            logger = logger,
            systemServiceProvider = systemServiceProvider,
        ).getNetworkType()

        assertNull(networkType)
    }

    @Test
    @Ignore("Specifying the SDK versions in @Config makes this test cause an OOM error after updating robolectric to 4.14")
    @Config(sdk = [21])
    fun `returns correct network type below API 23`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        shadowOf(systemServiceProvider.connectivityManager).setActiveNetworkInfo(
            systemServiceProvider.connectivityManager!!.getNetworkInfo(ConnectivityManager.TYPE_WIFI),
        )
        val networkType = InitialNetworkStateProviderImpl(
            context = context,
            logger = logger,
            systemServiceProvider = systemServiceProvider,
        ).getNetworkType()

        assertEquals(NetworkType.WIFI, networkType)
    }

    // Ideally we would like to test on multiple versions, but specifying the SDK versions
    // in @Config makes this test cause an OOM error after updating robolectric to 4.14
    // @Config(sdk = [23, 33])
    @Test
    fun `returns correct network type above API 23`() {
        shadowOf(context as Application).grantPermissions(Manifest.permission.ACCESS_NETWORK_STATE)
        val nc = ShadowNetworkCapabilities.newInstance()
        val network = ShadowNetwork.newInstance(789)
        shadowOf(nc).addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
        shadowOf(systemServiceProvider.connectivityManager).setNetworkCapabilities(
            network,
            nc,
        )
        shadowOf(systemServiceProvider.connectivityManager).setActiveNetworkInfo(
            ShadowNetworkInfo.newInstance(
                null,
                ConnectivityManager.TYPE_WIFI,
                TelephonyManager.NETWORK_TYPE_UNKNOWN,
                true,
                NetworkInfo.State.CONNECTED,
            ),
        )

        val networkType = InitialNetworkStateProviderImpl(
            context = context,
            logger = logger,
            systemServiceProvider = systemServiceProvider,
        ).getNetworkType()

        assertEquals(NetworkType.WIFI, networkType)
    }
}
