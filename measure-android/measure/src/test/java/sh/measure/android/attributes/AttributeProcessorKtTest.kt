package sh.measure.android.attributes

import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeEventFactory.toEvent

class AttributeProcessorKtTest {

    @Test
    fun `appends attributes to event`() {
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)

        val attributeProcessor1 = object : AttributeProcessor {
            override fun appendAttributes(attributes: MutableMap<String, Any?>) {
                attributes["key1"] = "value1"
            }
        }
        val attributeProcessor2 = object : AttributeProcessor {
            override fun appendAttributes(attributes: MutableMap<String, Any?>) {
                attributes["key2"] = "value2"
            }
        }

        // When
        event.appendAttributes(listOf(attributeProcessor1, attributeProcessor2))

        // Then
        assertEquals(true, event.attributes.containsKey("key1"))
        assertEquals(true, event.attributes.containsValue("value1"))
        assertEquals(true, event.attributes.containsKey("key2"))
        assertEquals(true, event.attributes.containsValue("value2"))
    }

    @Test
    fun `updates value if two attribute processors set value to same key`() {
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)

        val attributeProcessor1 = object : AttributeProcessor {
            override fun appendAttributes(attributes: MutableMap<String, Any?>) {
                attributes["key"] = "value1"
            }
        }
        val attributeProcessor2 = object : AttributeProcessor {
            override fun appendAttributes(attributes: MutableMap<String, Any?>) {
                attributes["key"] = "value2"
            }
        }

        // When
        event.appendAttributes(listOf(attributeProcessor1, attributeProcessor2))

        // Then
        assertEquals("value2", event.attributes["key"])
    }

    @Test
    fun `noop when empty list of processors is passed`() {
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)

        // When
        event.appendAttributes(emptyList())

        // Then
        assertEquals(0, event.attributes.size)
    }
}
