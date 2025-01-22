package sh.measure.android.utils

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`

class IdProviderImplTest {
    private val randomizer = mock<Randomizer>()
    private val idProvider = IdProviderImpl(randomizer)

    @Test
    fun `should generate span id with exactly 16 characters`() {
        // Given
        `when`(randomizer.nextLong()).thenReturn(123456789L)

        // When
        val spanId = idProvider.spanId()

        // Then
        assertEquals(16, spanId.length)
    }

    @Test
    fun `should generate valid hexadecimal span id`() {
        // Given
        `when`(randomizer.nextLong()).thenReturn(123456789L)

        // When
        val spanId = idProvider.spanId()

        // Then
        assertTrue(spanId.matches("[0-9a-fA-F]{16}".toRegex()))
    }

    @Test
    fun `should generate trace id with exactly 32 characters`() {
        // Given
        `when`(randomizer.nextLong()).thenReturn(123456789L, 987654321L)

        // When
        val traceId = idProvider.traceId()

        // Then
        assertEquals(32, traceId.length)
    }

    @Test
    fun `should generate valid hexadecimal trace id`() {
        // Given
        `when`(randomizer.nextLong()).thenReturn(123456789L, 987654321L)

        // When
        val traceId = idProvider.traceId()

        // Then
        assertTrue(traceId.matches("[0-9a-fA-F]{32}".toRegex()))
    }
}
