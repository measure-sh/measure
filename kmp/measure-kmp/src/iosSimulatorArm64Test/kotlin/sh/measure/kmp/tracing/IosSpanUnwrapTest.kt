package sh.measure.kmp.tracing

import kotlinx.cinterop.ExperimentalForeignApi
import sh.measure.kmp.attributes.AttributeValue
import kotlin.test.Test
import kotlin.test.assertFailsWith

@OptIn(ExperimentalForeignApi::class)
class IosSpanUnwrapTest {

    @Test
    fun `unwrap throws for foreign Span implementation`() {
        val foreign = object : Span {
            override val traceId = "trace-id"
            override val spanId = "span-id"
            override val parentId: String? = null
            override val isSampled = false
            override fun setStatus(status: SpanStatus): Span = this
            override fun setParent(parentSpan: Span): Span = this
            override fun setCheckpoint(name: String): Span = this
            override fun setName(name: String): Span = this
            override fun setAttribute(key: String, value: String): Span = this
            override fun setAttribute(key: String, value: Long): Span = this
            override fun setAttribute(key: String, value: Int): Span = this
            override fun setAttribute(key: String, value: Double): Span = this
            override fun setAttribute(key: String, value: Boolean): Span = this
            override fun setAttributes(attributes: Map<String, AttributeValue>): Span = this
            override fun removeAttribute(key: String): Span = this
            override fun end(): Span = this
            override fun end(timestamp: Long): Span = this
            override fun hasEnded() = false
            override fun getDuration() = 0L
        }

        assertFailsWith<IllegalStateException> { foreign.unwrap() }
    }
}
