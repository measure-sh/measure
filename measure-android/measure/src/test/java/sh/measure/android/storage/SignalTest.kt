package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.session.iso8601Timestamp
import sh.measure.android.storage.SessionContract.SignalsTable

@RunWith(AndroidJUnit4::class)
class SignalTest {

    @Test
    fun `maps signal to content values`() {
        val sessionId = "session123"
        val timestamp = 123456789L.iso8601Timestamp()
        val signalType = "event"
        val dataType = "exception"
        val data = "data"
        val signal = Signal(sessionId, timestamp, signalType, dataType, data)

        // When
        val contentValues = signal.toContentValues()

        // Assert
        assertEquals(sessionId, contentValues.getAsString(SignalsTable.COLUMN_SESSION_ID))
        assertEquals(timestamp, contentValues.getAsString(SignalsTable.COLUMN_TIMESTAMP))
        assertEquals(signalType, contentValues.getAsString(SignalsTable.COLUMN_SIGNAL_TYPE))
        assertEquals(dataType, contentValues.getAsString(SignalsTable.COLUMN_DATA_TYPE))
        assertEquals(data, contentValues.getAsString(SignalsTable.COLUMN_DATA))
    }
}