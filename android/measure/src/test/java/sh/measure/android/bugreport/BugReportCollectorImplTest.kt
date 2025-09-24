package sh.measure.android.bugreport

import android.app.Application
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.verify
import sh.measure.android.events.Attachment
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
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
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val signalProcessor: SignalProcessor = mock()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val application = InstrumentationRegistry.getInstrumentation().context as Application
    private val sessionManager = FakeSessionManager()
    private val fileStorage = FileStorageImpl(application.filesDir.path, logger)
    private val idProvider = FakeIdProvider()
    private val configProvider = FakeConfigProvider()
    private val resumedActivityProvider = ResumedActivityProviderImpl(application)
    private val bugReportCollector = BugReportCollectorImpl(
        logger = logger,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        ioExecutor = executorService,
        configProvider = configProvider,
        sessionManager = sessionManager,
        fileStorage = fileStorage,
        idProvider = idProvider,
        resumedActivityProvider = resumedActivityProvider,
    )

    @Test
    fun `tracks bug report event`() {
        // Given
        val attachmentsCaptor = argumentCaptor<MutableList<Attachment>>()
        val attachments = createTestFiles(count = 2).map {
            ParcelableAttachment(it.name, it.path)
        }
        val uris = createTestFiles(count = 3).map { Uri.fromFile(it) }
        val description = "description"

        // When
        bugReportCollector.track(application, description, attachments, uris)

        // Then
        verify(signalProcessor).track(
            data = eq(BugReportData(description)),
            timestamp = eq(timeProvider.now()),
            type = eq(EventType.BUG_REPORT),
            attributes = eq(emptyMap<String, Any?>().toMutableMap()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = attachmentsCaptor.capture(),
            threadName = any(),
            sessionId = isNull(),
            userTriggered = eq(false),
        )
        assertEquals(5, attachmentsCaptor.firstValue.size)
    }

    @Test
    fun `valid bug report has at least 1 attachment or 1 character`() {
        val invalid = bugReportCollector.validateBugReport(0, 0)
        assertFalse(invalid)

        val attachmentOnly = bugReportCollector.validateBugReport(1, 0)
        assertTrue(attachmentOnly)

        val descriptionOnly = bugReportCollector.validateBugReport(0, 1)
        assertTrue(descriptionOnly)
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
