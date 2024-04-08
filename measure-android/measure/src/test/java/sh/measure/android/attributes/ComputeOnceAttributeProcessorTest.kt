package sh.measure.android.attributes

import org.junit.Assert
import org.junit.Test
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeEventFactory.toEvent

class ComputeOnceAttributeProcessorTest {

    @Test
    fun `compute attributes is only called once when appending attributes`() {
        var computeAttributesCalledCount = 0

        // Given
        val processor = object : ComputeOnceAttributeProcessor() {
            override fun computeAttributes(): Map<String, Any?> {
                computeAttributesCalledCount++
                return mapOf("key" to "value")
            }
        }
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)

        // When
        processor.appendAttributes(event.attributes)
        processor.appendAttributes(event.attributes)
        processor.appendAttributes(event.attributes)

        // Then
        Assert.assertEquals(1, computeAttributesCalledCount)
    }
}
