package sh.measure.android.fakes

import sh.measure.android.utils.ProcProvider
import java.io.File

internal class FakeProcProvider : ProcProvider {
    internal val rss = 5000L
    internal val anonRss = 23456L
    internal val swap = 789L

    override fun getStatFile(pid: Int): File = createDummyProcStatFile()

    override fun getStatmFile(pid: Int): File = createDummyProcStatmFile()

    override fun getStatusFile(pid: Int): File = createDummyProcStatusFile()

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

    /**
     * The second value in this file corresponds to resident set size pages.
     */
    private fun createDummyProcStatmFile(): File = File.createTempFile("statm", "").apply {
        writeText("100000 $rss 2000 1000 500 0 0")
    }

    /**
     * A trimmed but realistic /proc/pid/status: RssAnon and VmSwap are what
     * anonRss()/swap() read. VmRSS and RssFile/RssShmem are included so a
     * regression back to reading total (not anonymous-only) RSS, or a
     * startsWith("RssAnon") prefix collision with a sibling Rss* field,
     * would be caught.
     */
    private fun createDummyProcStatusFile(): File = File.createTempFile("status", "").apply {
        writeText(
            """
            Name:	sample
            State:	S (sleeping)
            VmPeak:	  123456 kB
            VmSize:	  120000 kB
            VmRSS:	   99999 kB
            RssAnon:	   $anonRss kB
            RssFile:	   11111 kB
            RssShmem:	   2222 kB
            VmSwap:	     $swap kB
            Threads:	4
            """.trimIndent(),
        )
    }
}
