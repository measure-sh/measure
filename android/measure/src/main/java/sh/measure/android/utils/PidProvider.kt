package sh.measure.android.utils

import android.os.Process

internal interface PidProvider {
    fun getPid(): Int
}

internal class PidProviderImpl : PidProvider {
    override fun getPid(): Int = Process.myPid()
}
