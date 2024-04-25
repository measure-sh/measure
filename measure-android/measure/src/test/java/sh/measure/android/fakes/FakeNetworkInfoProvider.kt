package sh.measure.android.fakes

import sh.measure.android.networkchange.NetworkGeneration
import sh.measure.android.networkchange.InitialNetworkStateProvider
import sh.measure.android.networkchange.NetworkType

internal class FakeNetworkInfoProvider : InitialNetworkStateProvider {
    override fun getNetworkGeneration(networkType: String?): String {
        return NetworkGeneration.FIFTH_GEN
    }

    override fun getNetworkType(): String {
        return NetworkType.CELLULAR
    }

    override fun getNetworkProvider(networkType: String?): String {
        return "Android"
    }
}
