package sh.measure.android.storage

import org.mockito.Mockito.mock
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.NoopLogger
import java.io.File

internal class EventStoreTest {
    private val logger = NoopLogger()
    private val fileStorage = mock<FileStorage>()
    private val database = mock<Database>()
    private val idProvider = FakeIdProvider()

    private val eventStore: EventStore = EventStoreImpl(
        logger,
        fileStorage,
        database,
        idProvider,
    )

    private fun fakeAttachmentFile(): File {
        val file = File.createTempFile("fake-path", "txt")
        file.writeText(
            "lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        )
        return file
    }
}
