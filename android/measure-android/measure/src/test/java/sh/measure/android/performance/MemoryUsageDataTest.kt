package sh.measure.android.performance

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import sh.measure.android.events.EventType
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent
import sh.measure.android.storage.serializeDataToString

internal class MemoryUsageDataTest {
    @Test
    fun `serializes anonymous RSS and swap in KB on the memory usage event`() {
        val data = TestData.getMemoryUsageData().copy(anon_rss = 1234, swap = 0, app_importance = "foreground")
        val event = data.toEvent(type = EventType.MEMORY_USAGE)

        val json = Json.parseToJsonElement(event.serializeDataToString()).jsonObject

        assertEquals(1234L, json.getValue("anon_rss").jsonPrimitive.long)
        assertEquals(0L, json.getValue("swap").jsonPrimitive.long)
        assertEquals("foreground", json.getValue("app_importance").jsonPrimitive.content)
        assertEquals(data.rss, json.getValue("rss").jsonPrimitive.long)
    }

    @Test
    fun `decodes older memory payloads without anonymous RSS and swap`() {
        val payload = """
            {"java_max_heap":100,"java_total_heap":200,"java_free_heap":300,
             "total_pss":400,"rss":500,"native_total_heap":600,"native_free_heap":700,"interval":800}
        """.trimIndent()

        val data = Json.decodeFromString(MemoryUsageData.serializer(), payload)

        assertNull(data.anon_rss)
        assertNull(data.swap)
        assertEquals(500L, data.rss)
    }
}
