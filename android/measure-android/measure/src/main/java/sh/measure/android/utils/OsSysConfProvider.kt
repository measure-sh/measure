package sh.measure.android.utils

import android.system.Os

internal interface OsSysConfProvider {
    fun get(name: Int): Long
}

internal class OsSysConfProviderImpl : OsSysConfProvider {
    override fun get(name: Int): Long = Os.sysconf(name)
}
