package sh.measure.android.anr

import android.os.Looper
import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import sh.measure.android.NativeBridge
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.events.Attachment
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.NoopLogger

class AnrCollectorTest {
    private val logger = NoopLogger()
    private val processInfo = FakeProcessInfoProvider()
    private val signalProcessor = mock<SignalProcessor>()
    private val nativeBridge = mock<NativeBridge>()
    private val looper = mock<Looper>()
    private val anrCollector =
        AnrCollector(processInfo, signalProcessor, nativeBridge, looper)

    @Test
    fun `register enables anr reporting and registers itself as listener`() {
        anrCollector.register()
        verify(nativeBridge).enableAnrReporting(anrListener = anrCollector)
    }

    @Test
    fun `unregister disables anr reporting`() {
        anrCollector.register()
        verify(nativeBridge).enableAnrReporting(any())
        anrCollector.unregister()
        verify(nativeBridge).disableAnrReporting()
    }

    @Test
    fun `tracks ANR event when ANR is detected`() {
        val thread = Thread.currentThread()
        `when`(looper.thread).thenReturn(thread)
        val message = "ANR"
        val timestamp = 876544454L
        val expectedAnrError = AnrError(thread, timestamp, message)

        // When
        anrCollector.onAnrDetected(timestamp)

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
            threadName = eq(null),
            takeScreenshot = eq(true),
        )

        assertEquals(EventType.ANR, typeCaptor.firstValue)
        assertEquals(expectedAnrError.timestamp, timestampCaptor.firstValue)
        assertEquals(false, dataCaptor.firstValue.handled)
        assertEquals(processInfo.isForegroundProcess(), dataCaptor.firstValue.foreground)
    }
}
