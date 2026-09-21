package sh.measure.android.fakes

import sh.measure.android.utils.ProcProvider
import java.io.File

internal class FakeProcProvider : ProcProvider {
    var statusContent = """
        Name:   sample
        VmRSS:  5000 kB
        RssAnon:    4000 kB
        VmSwap: 200 kB
    """.trimIndent()
    var statusFileOverride: File? = null
    var statusFileAccessCount = 0
        private set

    override fun getStatFile(pid: Int): File = createDummyProcStatFile()

    override fun getStatusFile(): File {
        statusFileAccessCount++
        return statusFileOverride ?: File.createTempFile("status", null).apply {
            deleteOnExit()
            writeText(statusContent)
        }
    }

    /**
     * utime: 500
     * stime: 600
     * cutime: 100
     * cstime: 200
     * start_time: 5835385
     */
    private fun createDummyProcStatFile(): File = File.createTempFile("stat", null).apply {
        writeText(
            "15354 (.measure.sample) R 1274 1274 0 0 -1 4194624 16399 0 0 0 500 600 100 200 30 10 24 0 5835385 15334526976 31865 18446744073709551615 434698489856 434698501984 548727546288 0 0 0 4612 1 1073775864 0 0 0 17 7 0 0 0 0 0 434698502144 434698503416 434785861632 548727550460 548727550559 548727550559 548727554014 0",
        )
    }
}
