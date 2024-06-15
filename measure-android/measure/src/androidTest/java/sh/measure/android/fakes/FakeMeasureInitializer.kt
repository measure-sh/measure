package sh.measure.android.fakes

import android.app.Application
import sh.measure.android.MeasureInitializer
import sh.measure.android.SessionManager
import sh.measure.android.anr.AnrCollector
import sh.measure.android.appexit.AppExitCollector
import sh.measure.android.applaunch.AppLaunchCollector
import sh.measure.android.attributes.UserAttributeProcessor
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.EventProcessor
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.exporter.NetworkClient
import sh.measure.android.exporter.PeriodicEventExporter
import sh.measure.android.gestures.GestureCollector
import sh.measure.android.lifecycle.LifecycleCollector
import sh.measure.android.logger.Logger
import sh.measure.android.networkchange.NetworkChangesCollector
import sh.measure.android.okhttp.OkHttpEventCollector
import sh.measure.android.performance.ComponentCallbacksCollector
import sh.measure.android.performance.CpuUsageCollector
import sh.measure.android.performance.MemoryUsageCollector
import sh.measure.android.screenshot.ScreenshotCollector
import sh.measure.android.utils.ManifestReader
import sh.measure.android.utils.ResumedActivityProvider
import sh.measure.android.utils.TimeProvider

internal class FakeMeasureInitializer : MeasureInitializer {
    override lateinit var logger: Logger
    override lateinit var timeProvider: TimeProvider
    override lateinit var networkClient: NetworkClient
    override lateinit var configProvider: ConfigProvider
    override lateinit var manifestReader: ManifestReader
    override lateinit var resumedActivityProvider: ResumedActivityProvider
    override lateinit var eventProcessor: EventProcessor
    override lateinit var okHttpEventCollector: OkHttpEventCollector
    override lateinit var sessionManager: SessionManager
    override lateinit var unhandledExceptionCollector: UnhandledExceptionCollector
    override lateinit var anrCollector: AnrCollector
    override lateinit var appExitCollector: AppExitCollector
    override lateinit var cpuUsageCollector: CpuUsageCollector
    override lateinit var memoryUsageCollector: MemoryUsageCollector
    override lateinit var componentCallbacksCollector: ComponentCallbacksCollector
    override lateinit var lifecycleCollector: LifecycleCollector
    override lateinit var gestureCollector: GestureCollector
    override lateinit var appLaunchCollector: AppLaunchCollector
    override lateinit var networkChangesCollector: NetworkChangesCollector
    override lateinit var periodicEventExporter: PeriodicEventExporter
    override lateinit var userAttributeProcessor: UserAttributeProcessor
    override lateinit var screenshotCollector: ScreenshotCollector
}
