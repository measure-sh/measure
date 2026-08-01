package sh.measure.android.anr

import android.os.Looper
import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.events.Attachment
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.fakes.FakeProcessInfoProvider

class AnrCollectorTest {
    private val processInfo = FakeProcessInfoProvider()
    private val signalProcessor = mock<SignalProcessor>()
    private val looper = mock<Looper>()
    private val anrCollector = AnrCollector(processInfo, signalProcessor, looper)

    @Test
    fun `tracks ANR event when an ANR is reported`() {
        val thread = Thread.currentThread()
        `when`(looper.thread).thenReturn(thread)
        val message = "ANR"
        val timestamp = 876544454L
        val expectedAnrError = AnrError(thread, timestamp, message)

        // When
        anrCollector.onAnr(timestamp)

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
        )

        assertEquals(EventType.ANR, typeCaptor.firstValue)
        assertEquals(expectedAnrError.timestamp, timestampCaptor.firstValue)
        assertEquals(null, dataCaptor.firstValue.severity)
        assertEquals(processInfo.isForegroundProcess(), dataCaptor.firstValue.foreground)
    }
}
