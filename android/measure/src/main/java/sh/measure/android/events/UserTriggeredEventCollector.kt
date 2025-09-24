package sh.measure.android.events

import sh.measure.android.MsrAttachment
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.BugReportData
import sh.measure.android.config.ConfigProvider
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.toEventAttachment
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal interface UserTriggeredEventCollector {
    fun trackHandledException(throwable: Throwable, attributes: Map<String, AttributeValue>)
    fun trackScreenView(screenName: String, attributes: Map<String, AttributeValue>)
    fun register()
    fun unregister()
    fun trackBugReport(
        description: String,
        screenshots: List<MsrAttachment>,
        attributes: MutableMap<String, AttributeValue>,
    )
}

internal class UserTriggeredEventCollectorImpl(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val processInfoProvider: ProcessInfoProvider,
    private val configProvider: ConfigProvider,
) : UserTriggeredEventCollector {
    private var enabled = AtomicBoolean(false)

    override fun register() {
        enabled.compareAndSet(false, true)
    }

    override fun unregister() {
        enabled.compareAndSet(true, false)
    }

    override fun trackBugReport(
        description: String,
        screenshots: List<MsrAttachment>,
        attributes: MutableMap<String, AttributeValue>,
    ) {
        if (!enabled.get()) {
            return
        }
        val timestamp = timeProvider.now()
        val bugReportData = BugReportData(description)
        val attachments =
            screenshots.take(configProvider.maxAttachmentsInBugReport)
                .map { it.toEventAttachment(AttachmentType.SCREENSHOT) }.toMutableList()
        signalProcessor.trackUserTriggered(
            data = bugReportData,
            type = EventType.BUG_REPORT,
            timestamp = timestamp,
            attachments = attachments,
            userDefinedAttributes = attributes,
        )
        logger.log(LogLevel.Debug, "Bug report event received")
    }

    override fun trackHandledException(
        throwable: Throwable,
        attributes: Map<String, AttributeValue>,
    ) {
        if (!enabled.get()) {
            return
        }
        // this is a safe assumption that we're on the same thread as the exception was captured on
        val thread = Thread.currentThread()
        signalProcessor.trackUserTriggered(
            data = ExceptionFactory.createMeasureException(
                throwable = throwable,
                handled = true,
                thread = thread,
                foreground = processInfoProvider.isForegroundProcess(),
            ),
            timestamp = timeProvider.now(),
            type = EventType.EXCEPTION,
            userDefinedAttributes = attributes,
        )
        logger.log(LogLevel.Debug, "Unhandled exception event received")
    }

    override fun trackScreenView(screenName: String, attributes: Map<String, AttributeValue>) {
        if (!enabled.get()) {
            return
        }
        signalProcessor.trackUserTriggered(
            data = ScreenViewData(name = screenName),
            timestamp = timeProvider.now(),
            type = EventType.SCREEN_VIEW,
            userDefinedAttributes = attributes,
        )
        logger.log(LogLevel.Debug, "Screen view event received")
    }
}
