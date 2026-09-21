package sh.measure.android.config

import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import sh.measure.android.serialization.jsonSerializer

internal class DynamicConfigTest {
    @Test
    fun `omitted memory settings use defaults with older config payloads`() {
        val config = jsonSerializer.decodeFromString(
            DynamicConfig.serializer(),
            """{"memory_usage_interval":10,"journey_sampling_rate":0}""",
        )

        assertEquals(100f, config.memoryUsageSessionSamplingRate)
        assertEquals(10L, config.memoryUsageInterval)
        assertEquals(10L, config.memoryUsageBackgroundInterval)
        assertEquals(0f, config.journeySamplingRate)
    }

    @Test
    fun `decodes memory config wire names and fractional percentages`() {
        val payload = """
            {
                "memory_usage_session_sampling_rate": 25.5,
                "memory_usage_background_interval": 30
            }
        """.trimIndent()

        val config = jsonSerializer.decodeFromString(DynamicConfig.serializer(), payload)

        assertEquals(25.5f, config.memoryUsageSessionSamplingRate)
        assertEquals(30L, config.memoryUsageBackgroundInterval)
    }

    @Test
    fun `preserves percentage boundaries`() {
        for (percentage in listOf(0f, 100f)) {
            val payload = """
                {
                    "memory_usage_session_sampling_rate": $percentage
                }
            """.trimIndent()

            val config = jsonSerializer.decodeFromString(DynamicConfig.serializer(), payload)

            assertEquals(percentage, config.memoryUsageSessionSamplingRate)
        }
    }

    @Test
    fun `serializes memory config with snake case wire names`() {
        val config = DynamicConfig(
            memoryUsageSessionSamplingRate = 25.5f,
            memoryUsageBackgroundInterval = 30,
        )

        val serialized = jsonSerializer.encodeToString(DynamicConfig.serializer(), config)
        val fields = jsonSerializer.parseToJsonElement(serialized).jsonObject

        assertTrue(fields.containsKey("memory_usage_session_sampling_rate"))
        assertTrue(fields.containsKey("memory_usage_background_interval"))
        assertEquals(config, jsonSerializer.decodeFromString(DynamicConfig.serializer(), serialized))
    }
}
