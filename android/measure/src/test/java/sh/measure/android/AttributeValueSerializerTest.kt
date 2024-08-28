package sh.measure.android

import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AttributeValueSerializerTest {
    private val json = Json { prettyPrint = false }

    @Test
    fun testSerializeString() {
        val attr = StringAttr("test")
        val serialized = json.encodeToString(AttributeValueSerializer, attr)
        assertEquals("\"test\"", serialized)
    }

    @Test
    fun testSerializeBoolean() {
        val attr = BooleanAttr(true)
        val serialized = json.encodeToString(AttributeValueSerializer, attr)
        assertEquals("true", serialized)
    }

    @Test
    fun testSerializeInt() {
        val attr = IntAttr(42)
        val serialized = json.encodeToString(AttributeValueSerializer, attr)
        assertEquals("42", serialized)
    }

    @Test
    fun testSerializeDouble() {
        val attr = DoubleAttr(3.14)
        val serialized = json.encodeToString(AttributeValueSerializer, attr)
        assertEquals("3.14", serialized)
    }

    @Test
    fun testDeserializeString() {
        val json = "\"test\""
        val deserialized = this.json.decodeFromString(AttributeValueSerializer, json)
        assertTrue(deserialized is StringAttr)
        assertEquals("test", (deserialized as StringAttr).value)
    }

    @Test
    fun testDeserializeBoolean() {
        val json = "true"
        val deserialized = this.json.decodeFromString(AttributeValueSerializer, json)
        assertTrue(deserialized is BooleanAttr)
        assertEquals(true, (deserialized as BooleanAttr).value)
    }

    @Test
    fun testDeserializeInt() {
        val json = "42"
        val deserialized = this.json.decodeFromString(AttributeValueSerializer, json)
        assertTrue(deserialized is IntAttr)
        assertEquals(42, (deserialized as IntAttr).value)
    }

    @Test
    fun testDeserializeDouble() {
        val json = "3.14"
        val deserialized = this.json.decodeFromString(AttributeValueSerializer, json)
        assertTrue(deserialized is DoubleAttr)
        assertEquals(3.14, (deserialized as DoubleAttr).value, 0.001)
    }

    @Test
    fun testSerializeDeserializeAttributes() {
        val attributes = buildAttributes {
            put("string", "test")
            put("boolean", true)
            put("int", 42)
            put("double", 3.14)
        }
        val serialized = json.encodeToString(
            MapSerializer(String.serializer(), AttributeValue.serializer()),
            attributes,
        )
        val deserialized = json.decodeFromString(
            MapSerializer(String.serializer(), AttributeValue.serializer()),
            serialized,
        )
        assertEquals(attributes, deserialized)
    }

    @Test
    fun testEmptyAttributes() {
        val attributes = buildAttributes { }
        val serialized = json.encodeToString(
            MapSerializer(String.serializer(), AttributeValue.serializer()),
            attributes,
        )
        val deserialized = json.decodeFromString(
            MapSerializer(String.serializer(), AttributeValue.serializer()),
            serialized,
        )
        assertEquals(attributes, deserialized)
        assertTrue(attributes.isEmpty())
    }

    @Test
    fun testLargeNumberOfAttributes() {
        val attributes = buildAttributes {
            for (i in 1..1000) {
                put("key$i", i)
            }
        }
        val serialized = json.encodeToString(
            MapSerializer(String.serializer(), AttributeValue.serializer()),
            attributes,
        )
        val deserialized = json.decodeFromString(
            MapSerializer(String.serializer(), AttributeValue.serializer()),
            serialized,
        )
        assertEquals(attributes, deserialized)
        assertEquals(1000, attributes.size)
    }

    @Test(expected = kotlinx.serialization.SerializationException::class)
    fun testDeserializeInvalidJson() {
        val invalidJson = "{\"invalid\": []}"
        json.decodeFromString(AttributeValueSerializer, invalidJson)
    }

    @Test
    fun testSerializeDeserializeUnicodeStrings() {
        val unicodeString = "こんにちは世界"
        val attr = StringAttr(unicodeString)
        val serialized = json.encodeToString(AttributeValueSerializer, attr)
        val deserialized = json.decodeFromString(AttributeValueSerializer, serialized)
        assertTrue(deserialized is StringAttr)
        assertEquals(unicodeString, (deserialized as StringAttr).value)
    }

    @Test
    fun testSerializeDeserializeSpecialCharacters() {
        val specialChars = "!@#$%^&*()_+{}[]|\\:;\"'<>,.?/~`"
        val attr = StringAttr(specialChars)
        val serialized = json.encodeToString(AttributeValueSerializer, attr)
        val deserialized = json.decodeFromString(AttributeValueSerializer, serialized)
        assertTrue(deserialized is StringAttr)
        assertEquals(specialChars, (deserialized as StringAttr).value)
    }

    @Test
    fun testSerializeDeserializeExtremeNumericValues() {
        val intAttr = IntAttr(Int.MAX_VALUE)
        val doubleAttr = DoubleAttr(Double.MIN_VALUE)

        val serializedInt = json.encodeToString(AttributeValueSerializer, intAttr)
        val serializedDouble = json.encodeToString(AttributeValueSerializer, doubleAttr)

        val deserializedInt = json.decodeFromString(AttributeValueSerializer, serializedInt)
        val deserializedDouble = json.decodeFromString(AttributeValueSerializer, serializedDouble)

        assertEquals(Int.MAX_VALUE, (deserializedInt as IntAttr).value)
        assertEquals(Double.MIN_VALUE, (deserializedDouble as DoubleAttr).value, 0.0)
    }
}
