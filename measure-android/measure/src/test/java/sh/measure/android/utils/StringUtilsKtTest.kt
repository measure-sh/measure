package sh.measure.android.utils

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StringUtilsKtTest {
    @Test
    fun `isLowerCase returns true for lowercase string`() {
        assertTrue("abc".isLowerCase())
    }

    @Test
    fun `isLowerCase returns true for empty string`() {
        assertTrue("".isLowerCase())
    }

    @Test
    fun `isLowerCase returns true for string with digits`() {
        assertTrue("abc123".isLowerCase())
    }

    @Test
    fun `isLowerCase returns false for string with uppercase letters`() {
        assertFalse("Abc".isLowerCase())
    }
}