package sh.measure.kmp.tracing

import kotlin.test.Test
import kotlin.test.assertEquals
import sh.measure.android.tracing.SpanStatus as SdkSpanStatus

class SpanStatusConverterTest {

    @Test
    fun `Unset maps to SdkSpanStatus Unset`() {
        assertEquals(SdkSpanStatus.Unset, SpanStatus.Unset.toAndroid())
    }

    @Test
    fun `Ok maps to SdkSpanStatus Ok`() {
        assertEquals(SdkSpanStatus.Ok, SpanStatus.Ok.toAndroid())
    }

    @Test
    fun `Error maps to SdkSpanStatus Error`() {
        assertEquals(SdkSpanStatus.Error, SpanStatus.Error.toAndroid())
    }
}
