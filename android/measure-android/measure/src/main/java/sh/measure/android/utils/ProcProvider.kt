package sh.measure.android.utils

import java.io.File

internal interface ProcProvider {
    fun getStatFile(pid: Int): File
    fun getStatusFile(): File
}

internal class ProcProviderImpl : ProcProvider {
    override fun getStatFile(pid: Int): File = File("/proc/$pid/stat")

    override fun getStatusFile(): File = File("/proc/self/status")
}
