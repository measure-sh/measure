package sh.measure.android.utils

import android.Manifest.permission.READ_BASIC_PHONE_STATE
import android.Manifest.permission.READ_PHONE_STATE
import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.telephony.TelephonyManager
import androidx.annotation.RequiresPermission
import sh.measure.android.networkchange.NetworkGeneration

internal fun hasPhoneStatePermission(context: Context): Boolean = when {
    hasPermission(context, READ_PHONE_STATE) -> {
        true
    }

    Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> {
        hasPermission(context, READ_BASIC_PHONE_STATE)
    }

    else -> {
        false
    }
}

@Suppress("DEPRECATION")
@SuppressLint("InlinedApi")
@RequiresPermission(anyOf = [READ_PHONE_STATE, READ_BASIC_PHONE_STATE])
internal fun TelephonyManager.getNetworkGeneration(): String? = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
    internalNetworkGeneration(this.networkType)
} else {
    val networkType = this.dataNetworkType
    internalNetworkGeneration(networkType)
}

private fun internalNetworkGeneration(networkType: Int): String? {
    when (networkType) {
        TelephonyManager.NETWORK_TYPE_GPRS, TelephonyManager.NETWORK_TYPE_EDGE,
        TelephonyManager.NETWORK_TYPE_CDMA, TelephonyManager.NETWORK_TYPE_1xRTT,
        TelephonyManager.NETWORK_TYPE_IDEN, TelephonyManager.NETWORK_TYPE_GSM,
        -> {
            return NetworkGeneration.SECOND_GEN
        }

        TelephonyManager.NETWORK_TYPE_UMTS, TelephonyManager.NETWORK_TYPE_EVDO_0,
        TelephonyManager.NETWORK_TYPE_EVDO_A, TelephonyManager.NETWORK_TYPE_HSDPA,
        TelephonyManager.NETWORK_TYPE_HSUPA, TelephonyManager.NETWORK_TYPE_HSPA,
        TelephonyManager.NETWORK_TYPE_EVDO_B, TelephonyManager.NETWORK_TYPE_EHRPD,
        TelephonyManager.NETWORK_TYPE_HSPAP, TelephonyManager.NETWORK_TYPE_TD_SCDMA,
        -> {
            return NetworkGeneration.THIRD_GEN
        }

        TelephonyManager.NETWORK_TYPE_LTE -> {
            return NetworkGeneration.FOURTH_GEN
        }

        TelephonyManager.NETWORK_TYPE_NR -> {
            return NetworkGeneration.FIFTH_GEN
        }

        else -> {
            return null
        }
    }
}
