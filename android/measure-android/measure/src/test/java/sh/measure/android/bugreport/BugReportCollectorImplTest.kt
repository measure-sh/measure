package sh.measure.android.bugreport

import android.app.Application
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import android.os.Looper
import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.robolectric.Robolectric
import org.robolectric.Shadows.shadowOf
import sh.measure.android.TestLifecycleActivity
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.attributes.StringAttr
import sh.measure.android.events.Attachment
import sh.measure.android.events.SignalProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.fakes.DeferredExecutorService
import sh.measure.android.fakes.FakeAttachmentEncoder
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorageImpl
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.ResumedActivityProviderImpl
import sh.measure.android.utils.TestClock
import java.io.File
import java.io.FileOutputStream

@RunWith(AndroidJUnit4::class)
class BugReportCollectorImplTest {
    private val logger: Logger = NoopLogger()
    private val signalProcessor: SignalProcessor = mock()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val application = InstrumentationRegistry.getInstrumentation().context as Application
    private val configProvider = FakeConfigProvider()
    private val sessionManager = FakeSessionManager()
    private val idProvider = FakeIdProvider()
    private val fileStorage = FileStorageImpl(application.filesDir.path, logger)
    private val attachmentEncoder = FakeAttachmentEncoder()
    private val resumedActivityProvider = ResumedActivityProviderImpl(application).apply {
        register()
    }

    private lateinit var activity: TestLifecycleActivity

    @Before
    fun setup() {
        activity = Robolectric.buildActivity(TestLifecycleActivity::class.java).setup().get()
        attachmentEncoder.encoded = EncodedScreenshot(
            name = "screenshot.png",
            path = createTestFiles(count = 1).first().path,
        )
    }

    @Test
    fun `launches the bug report screen before the screenshot is encoded`() {
        val executor = DeferredExecutorService()
        val collector = collector(executor)

        collector.startBugReportFlow()

        assertEquals(
            MsrBugReportActivity::class.java.name,
            shadowOf(activity).nextStartedActivity.component?.className,
        )
        assertEquals(1, executor.pendingTaskCount)
        assertTrue(collector.getSession()?.screenshot?.isPreparing() == true)
    }

    @Test
    fun `shows the scaled preview rather than the captured screen`() {
        val collector = collector(DeferredExecutorService())

        collector.startBugReportFlow()

        assertEquals(attachmentEncoder.preview, collector.getSession()?.screenshot?.preview)
    }

    @Test
    fun `does not put the screenshot in the launch intent`() {
        val collector = collector(DeferredExecutorService())

        collector.startBugReportFlow()

        val extras = shadowOf(activity).nextStartedActivity.extras
        assertEquals(
            setOf(
                BugReportCollector.MAX_ATTACHMENTS_EXTRA,
                BugReportCollector.MAX_DESCRIPTION_LENGTH,
            ),
            extras?.keySet(),
        )
    }

    @Test
    fun `delivers the encoded screenshot to the session`() {
        val executor = DeferredExecutorService()
        val collector = collector(executor)
        collector.startBugReportFlow()
        val slot = collector.getSession()?.screenshot
        var delivered: EncodedScreenshot? = null
        slot?.setListener { delivered = it }

        executor.runAll()
        shadowOf(Looper.getMainLooper()).idle()

        assertFalse(slot?.isPreparing() == true)
        assertEquals(attachmentEncoder.encoded, delivered)
    }

    @Test
    fun `delivers nothing when the screenshot fails to encode`() {
        attachmentEncoder.encoded = null
        val executor = DeferredExecutorService()
        val collector = collector(executor)
        collector.startBugReportFlow()
        val slot = collector.getSession()?.screenshot
        var notified = false
        slot?.setListener { notified = true }

        executor.runAll()
        shadowOf(Looper.getMainLooper()).idle()

        assertTrue(notified)
        assertNull(slot?.encoded)
        assertFalse(slot?.isPreparing() == true)
    }

    @Test
    fun `tracks the screenshot when sent before encoding completes`() {
        val executor = DeferredExecutorService()
        val collector = collector(executor)
        collector.startBugReportFlow()

        collector.track(application, "description", listOf(BugReportAttachment.Capture))
        executor.runAll()

        val attachments = trackedAttachments()
        assertEquals(1, attachments.size)
        assertEquals(attachmentEncoder.encoded?.name, attachments.first().name)
    }

    @Test
    fun `tracks a screenshot restored from disk`() {
        val collector = collector(ImmediateExecutorService(ResolvableFuture.create()))
        val file = createTestFiles(count = 1).first()

        collector.track(
            application,
            "description",
            listOf(BugReportAttachment.Screenshot("screenshot.png", file.path)),
        )

        val attachments = trackedAttachments()
        assertEquals(1, attachments.size)
        assertEquals("screenshot.png", attachments.first().name)
    }

    @Test
    fun `does not track a discarded screenshot`() {
        val executor = DeferredExecutorService()
        val collector = collector(executor)
        collector.startBugReportFlow()
        val session = collector.getSession()

        session?.let { collector.discardSession(it) }
        collector.track(application, "description", emptyList())
        executor.runAll()

        assertEquals(0, trackedAttachments().size)
        assertTrue(session?.screenshot?.encodeFuture?.isCancelled == true)
    }

    @Test
    fun `deletes an encoded screenshot that was discarded`() {
        val executor = DeferredExecutorService()
        val collector = collector(executor)
        collector.startBugReportFlow()
        val session = collector.getSession()
        executor.runAll()
        shadowOf(Looper.getMainLooper()).idle()

        session?.let { collector.discardScreenshot(it) }
        executor.runAll()

        assertEquals(
            listOf(attachmentEncoder.encoded?.path),
            attachmentEncoder.deletedPaths,
        )
    }

    @Test
    fun `does not capture a screenshot when takeScreenshot is false`() {
        val executor = DeferredExecutorService()
        val collector = collector(executor)

        collector.startBugReportFlow(takeScreenshot = false)

        assertNull(collector.getSession()?.screenshot)
        assertEquals(0, executor.pendingTaskCount)
        assertEquals(
            MsrBugReportActivity::class.java.name,
            shadowOf(activity).nextStartedActivity.component?.className,
        )
    }

    @Test
    fun `runs a flow started off the main thread on the main thread`() {
        val executor = DeferredExecutorService()
        val collector = collector(executor)

        val thread = Thread { collector.startBugReportFlow() }
        thread.start()
        thread.join()

        assertNull(collector.getSession())
        shadowOf(Looper.getMainLooper()).idle()
        assertNotNull(collector.getSession())
        assertEquals(
            MsrBugReportActivity::class.java.name,
            shadowOf(activity).nextStartedActivity.component?.className,
        )
    }

    @Test
    fun `keeps an already encoded screenshot when a new flow starts`() {
        val executor = DeferredExecutorService()
        val collector = collector(executor)
        collector.startBugReportFlow()
        val first = collector.getSession()?.screenshot
        executor.runAll()
        shadowOf(Looper.getMainLooper()).idle()

        collector.startBugReportFlow()
        executor.runAll()

        assertEquals(attachmentEncoder.encoded, first?.encoded)
        assertTrue(attachmentEncoder.deletedPaths.isEmpty())
    }

    @Test
    fun `discards the previous screenshot when a new flow starts`() {
        val executor = DeferredExecutorService()
        val collector = collector(executor)
        collector.startBugReportFlow()
        val first = collector.getSession()?.screenshot
        var notified = false
        first?.setListener { notified = true }

        collector.startBugReportFlow()

        assertTrue(notified)
        assertNull(first?.preview)
        assertNotSame(first, collector.getSession()?.screenshot)
    }

    @Test
    fun `tracks the attributes the flow was started with`() {
        val executor = DeferredExecutorService()
        val collector = collector(executor)
        val attributes = mutableMapOf<String, AttributeValue>("key" to StringAttr("value"))
        collector.startBugReportFlow(attributes = attributes)

        collector.track(application, "description", emptyList())
        executor.runAll()

        verify(signalProcessor).track(
            data = any<BugReportData>(),
            timestamp = any(),
            type = any(),
            attributes = any(),
            userDefinedAttributes = eq(attributes),
            attachments = any(),
            threadName = anyOrNull(),
            sessionId = anyOrNull(),
            userTriggered = any(),
            isSampled = any(),
        )
    }

    @Test
    fun `tracks images picked from the gallery`() {
        val collector = collector(
            ImmediateExecutorService(ResolvableFuture.create()),
            AttachmentEncoderImpl(
                logger = logger,
                configProvider = configProvider,
                fileStorage = fileStorage,
                idProvider = idProvider,
                sessionManager = sessionManager,
            ),
        )
        val images = createTestFiles(count = 3).map { BugReportAttachment.Image(Uri.fromFile(it)) }

        collector.track(application, "description", images)

        assertEquals(3, trackedAttachments().size)
    }

    @Test
    fun `valid bug report has at least 1 attachment or 1 character`() {
        val collector = collector(DeferredExecutorService())

        assertFalse(collector.validateBugReport(0, 0))
        assertTrue(collector.validateBugReport(1, 0))
        assertTrue(collector.validateBugReport(0, 1))
    }

    private fun collector(
        executor: MeasureExecutorService,
        encoder: AttachmentEncoder = attachmentEncoder,
    ) = BugReportCollectorImpl(
        logger = logger,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        ioExecutor = executor,
        configProvider = configProvider,
        resumedActivityProvider = resumedActivityProvider,
        attachmentEncoder = encoder,
    )

    private fun trackedAttachments(): MutableList<Attachment> {
        val captor = argumentCaptor<MutableList<Attachment>>()
        verify(signalProcessor).track(
            data = any<BugReportData>(),
            timestamp = any(),
            type = any(),
            attributes = any(),
            userDefinedAttributes = any(),
            attachments = captor.capture(),
            threadName = anyOrNull(),
            sessionId = anyOrNull(),
            userTriggered = any(),
            isSampled = any(),
        )
        return captor.firstValue
    }

    private fun createTestFiles(count: Int = 2): List<File> {
        val testBitmap = Bitmap.createBitmap(100, 100, Bitmap.Config.ARGB_8888).apply {
            Canvas(this).drawColor(Color.RED)
        }

        return List(count) { index ->
            File(application.filesDir, "test_screenshot${index + 1}.png").also { file ->
                FileOutputStream(file).use { out ->
                    testBitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                }
            }
        }
    }
}
