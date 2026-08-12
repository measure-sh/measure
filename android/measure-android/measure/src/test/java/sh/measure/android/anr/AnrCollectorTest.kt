package sh.measure.android.anr

import android.os.Build
import android.os.Looper
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.atLeast
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import sh.measure.android.NativeBridge
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.events.Attachment
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.fakes.FakeProcessInfoProvider

@RunWith(RobolectricTestRunner::class)
class AnrCollectorTest {
    private val processInfo = FakeProcessInfoProvider()
    private val signalProcessor = mock<SignalProcessor>()
    private val nativeBridge = mock<NativeBridge>()
    private val anrCollector = AnrCollector(processInfo, signalProcessor, nativeBridge)

    @Test
    fun `register enables anr reporting and registers itself as listener`() {
        anrCollector.register()
        verify(nativeBridge).enableAnrReporting(listener = anrCollector)
    }

    @Test
    fun `unregister disables anr reporting`() {
        anrCollector.register()
        verify(nativeBridge).enableAnrReporting(any())
        anrCollector.unregister()
        verify(nativeBridge).disableAnrReporting()
    }

    @Test
    fun `tracks ANR event when an ANR is reported`() {
        val thread = Looper.getMainLooper().thread
        val timestamp = 876544454L

        // When
        anrCollector.onSigquit(timestamp)

        // Then
        val typeCaptor = argumentCaptor<EventType>()
        val timestampCaptor = argumentCaptor<Long>()
        val dataCaptor = argumentCaptor<ExceptionData>()
        val attributesCaptor = argumentCaptor<MutableMap<String, Any?>>()
        val attachmentsCaptor = argumentCaptor<MutableList<Attachment>>()
        val userDefinedAttributeCaptor = argumentCaptor<Map<String, AttributeValue>>()

        // the arguments must be in the same order as the method signature, otherwise
        // argumentCaptor will not capture the correct value and verify will fail.
        verify(signalProcessor).trackCrash(
            data = dataCaptor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = attributesCaptor.capture(),
            userDefinedAttributes = userDefinedAttributeCaptor.capture(),
            attachments = attachmentsCaptor.capture(),
            threadName = eq(thread.name),
            takeScreenshot = eq(true),
            draft = any(),
        )

        assertEquals(EventType.ANR, typeCaptor.firstValue)
        assertEquals(timestamp, timestampCaptor.firstValue)
        assertEquals(null, dataCaptor.firstValue.severity)
        assertEquals(processInfo.isForegroundProcess(), dataCaptor.firstValue.foreground)
    }

    @Test
    fun `tracks one anr for every signal of a single stall`() {
        // The system collects stacks once per deadline it trips, and each collection
        // raises SIGQUIT, so one stalled main thread arrives as several signals.
        anrCollector.onSigquit(1000)
        anrCollector.onSigquit(7000)
        anrCollector.onSigquit(13000)

        assertEquals(listOf(1000L), trackedTimestamps())
    }

    @Test
    fun `tracks again once the main thread recovers`() {
        anrCollector.onSigquit(1000)
        shadowOf(Looper.getMainLooper()).idle()

        anrCollector.onSigquit(60000)

        assertEquals(listOf(1000L, 60000L), trackedTimestamps())
    }

    @Test
    fun `unregister clears the stall so a later signal is tracked`() {
        anrCollector.register()
        anrCollector.onSigquit(1000)
        anrCollector.unregister()

        anrCollector.onSigquit(60000)

        assertEquals(listOf(1000L, 60000L), trackedTimestamps())
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.R])
    fun `tracks the anr as a draft, leaving room for the system's thread dump`() {
        anrCollector.onSigquit(1000)

        assertEquals(true, trackedDraftFlag())
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.Q])
    fun `tracks the anr ready to export below API 30, where no exit record can arrive`() {
        anrCollector.onSigquit(1000)

        assertEquals(false, trackedDraftFlag())
    }

    private fun trackedDraftFlag(): Boolean {
        val draftCaptor = argumentCaptor<Boolean>()
        verify(signalProcessor).trackCrash(
            data = any(),
            timestamp = any(),
            type = any(),
            attributes = any(),
            userDefinedAttributes = any(),
            attachments = any(),
            threadName = any(),
            takeScreenshot = any(),
            draft = draftCaptor.capture(),
        )
        return draftCaptor.firstValue
    }

    private fun trackedTimestamps(): List<Long> {
        val timestampCaptor = argumentCaptor<Long>()
        verify(signalProcessor, atLeast(0)).trackCrash(
            data = any(),
            timestamp = timestampCaptor.capture(),
            type = any(),
            attributes = any(),
            userDefinedAttributes = any(),
            attachments = any(),
            threadName = any(),
            takeScreenshot = any(),
            draft = any(),
        )
        return timestampCaptor.allValues
    }
}
