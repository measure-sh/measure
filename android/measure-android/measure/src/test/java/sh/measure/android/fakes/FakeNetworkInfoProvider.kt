package sh.measure.android.fakes

import sh.measure.android.networkchange.InitialNetworkStateProvider
import sh.measure.android.networkchange.NetworkGeneration
import sh.measure.android.networkchange.NetworkType

internal class FakeNetworkInfoProvider : InitialNetworkStateProvider {
    override fun getNetworkGeneration(networkType: String?): String = NetworkGeneration.FIFTH_GEN

    override fun getNetworkType(): String = NetworkType.CELLULAR

    override fun getNetworkProvider(networkType: String?): String = "Android"
}
