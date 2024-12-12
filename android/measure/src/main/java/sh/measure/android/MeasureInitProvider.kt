package sh.measure.android

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.content.pm.ProviderInfo
import android.database.Cursor
import android.net.Uri
import android.os.SystemClock
import sh.measure.android.applaunch.LaunchState

/**
 * A content provider used to mark the start time of the application, used to calculate the cold
 * start time.
 */
internal class MeasureInitProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        return true
    }

    override fun attachInfo(context: Context?, info: ProviderInfo) {
        // applicationId is expected to be prepended. Content providers need to have a unique
        // authority across the OS. Prepending the applicationId in manifest helps us achieve this
        // uniqueness.
        check(MeasureInitProvider::class.java.name != info.authority) {
            "An applicationId is required to fulfill the manifest placeholder."
        }
        LaunchState.contentLoaderAttachElapsedRealtime = SystemClock.elapsedRealtime()
        super.attachInfo(context, info)
    }

    override fun query(
        uri: Uri,
        projection: Array<String?>?,
        selection: String?,
        selectionArgs: Array<String?>?,
        sortOrder: String?,
    ): Cursor? {
        throw IllegalStateException("Not allowed.")
    }

    override fun getType(uri: Uri): String? {
        throw IllegalStateException("Not allowed.")
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? {
        throw IllegalStateException("Not allowed.")
    }

    override fun delete(
        uri: Uri,
        selection: String?,
        selectionArgs: Array<String?>?,
    ): Int {
        throw IllegalStateException("Not allowed.")
    }

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<String?>?,
    ): Int {
        throw IllegalStateException("Not allowed.")
    }
}
