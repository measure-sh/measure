package sh.measure.android.tracing

import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.TimeProvider

internal class MsrSpan(
    private val logger: Logger,
    private val timeProvider: TimeProvider,
    override val name: String,
    override val spanId: String,
    private val startTime: Long,
    private val startElapsedRealtime: Long,
) : Span {
    private val lock = Any()
    private var status = SpanStatus.Unset
    private var endTime = 0L
    private var hasEnded: EndState = EndState.NotEnded

    companion object {
        fun startSpan(
            name: String,
            logger: Logger,
            timeProvider: TimeProvider,
            idProvider: IdProvider,
            timeMs: Long? = null,
        ): Span {
            val startTime = timeMs ?: timeProvider.currentTimeSinceEpochInMillis
            val startElapsedRealtime = timeProvider.elapsedRealtime
            val spanId: String = idProvider.createId()
            return MsrSpan(
                logger,
                timeProvider,
                name,
                spanId,
                startTime,
                startElapsedRealtime,
            )
        }
    }

    override fun setStatus(status: SpanStatus): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Debug,
                    "̄Attempt to modify a span($name) that has already ended",
                )
                return this
            }
            this.status = status
            return this
        }
    }

    override fun end(): Span {
        endSpanInternal {
            startTime + (timeProvider.elapsedRealtime - startElapsedRealtime)
        }
        return this
    }

    override fun end(timeMs: Long): Span {
        endSpanInternal { timeMs }
        return this
    }

    override fun hasEnded(): Boolean {
        synchronized(lock) {
            return hasEnded != EndState.NotEnded
        }
    }

    private fun endSpanInternal(calculateEndTime: () -> Long) {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(LogLevel.Debug, "Attempt to end a span($name) that has already ended")
                return
            }
            endTime = calculateEndTime()
            hasEnded = EndState.Ending
        }
        // TODO: span processor onEnding
        synchronized(lock) {
            hasEnded = EndState.Ended
        }
        // TODO: span processor onEnd
    }

    override fun toSpanData(): SpanData {
        synchronized(lock) {
            return SpanData(
                spanId = spanId,
                name = name,
                startTime = startTime,
                endTime = endTime,
                status = status,
                hasEnded = hasEnded == EndState.Ended,
            )
        }
    }

    private enum class EndState {
        NotEnded,
        Ending,
        Ended,
    }
}
