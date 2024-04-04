package sh.measure.android.attachments

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.fakes.FakeAttachmentStore
import sh.measure.android.fakes.FakeSessionIdProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger

class AttachmentProcessorTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val timeProvider = FakeTimeProvider()
    private val attachmentStore = FakeAttachmentStore()
    private val logger = NoopLogger()

    @Test
    fun `stores attachment and returns a non-null path`() {
        val attachmentInfo = AttachmentInfo(
            name = "name",
            extension = "extension",
            type = AttachmentType.METHOD_TRACE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis
        )

        val processor = AttachmentProcessorImpl(
            logger, executorService, attachmentStore, emptyList()
        )
        val path = processor.createMethodTrace(attachmentInfo)

        assertEquals(1, attachmentStore.storedAttachments.size)
        assertNotNull(path)
    }

    @Test
    fun `applies attributes from attribute processors`() {
        var attributeProcessorCalledCount = 0
        val attachmentInfo = AttachmentInfo(
            name = "name",
            extension = "extension",
            type = AttachmentType.METHOD_TRACE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis
        )
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(attributes: MutableMap<String, Any?>) {
                attributeProcessorCalledCount++
            }
        }

        AttachmentProcessorImpl(
            logger, executorService, attachmentStore, listOf(attributeProcessor)
        ).apply {
            createMethodTrace(attachmentInfo)
        }

        assertEquals(1, attributeProcessorCalledCount)
    }

    @Test
    fun `does not store attachment method trace creation results in a null path`() {
        val attachmentInfo = AttachmentInfo(
            name = "name",
            extension = "extension",
            type = AttachmentType.METHOD_TRACE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis
        )
        attachmentStore.createMethodTraceReturnValue = null

        val processor = AttachmentProcessorImpl(
            logger, executorService, attachmentStore, emptyList()
        )
        val path = processor.createMethodTrace(attachmentInfo)

        assertEquals(0, attachmentStore.storedAttachments.size)
        assertNull(path)
    }
}
