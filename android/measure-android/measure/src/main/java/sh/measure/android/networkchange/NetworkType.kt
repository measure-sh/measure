package sh.measure.android.networkchange

internal object NetworkType {
    const val WIFI = "wifi"
    const val CELLULAR = "cellular"
    const val VPN = "vpn"
    const val UNKNOWN = "unknown"
    const val NO_NETWORK = "no_network"
}

internal object NetworkGeneration {
    const val SECOND_GEN = "2g"
    const val THIRD_GEN = "3g"
    const val FOURTH_GEN = "4g"
    const val FIFTH_GEN = "5g"
    const val UNKNOWN = "unknown"
}

internal object NetworkProvider {
    const val UNKNOWN = "unknown"
}
