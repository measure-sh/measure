package sh.measure.android.bugreport

import android.net.Uri
import android.os.Parcel
import android.os.Parcelable

internal sealed interface BugReportAttachment : Parcelable {
    object Capture : BugReportAttachment {
        override fun describeContents(): Int = 0

        override fun writeToParcel(parcel: Parcel, flags: Int) = Unit

        @JvmField
        val CREATOR: Parcelable.Creator<Capture> = object : Parcelable.Creator<Capture> {
            override fun createFromParcel(parcel: Parcel): Capture = Capture

            override fun newArray(size: Int): Array<Capture?> = arrayOfNulls(size)
        }
    }

    data class Screenshot(val name: String, val path: String) : BugReportAttachment {
        override fun describeContents(): Int = 0

        override fun writeToParcel(parcel: Parcel, flags: Int) {
            parcel.writeString(name)
            parcel.writeString(path)
        }

        internal companion object CREATOR : Parcelable.Creator<Screenshot> {
            override fun createFromParcel(parcel: Parcel): Screenshot = Screenshot(
                parcel.readString()!!,
                parcel.readString()!!,
            )

            override fun newArray(size: Int): Array<Screenshot?> = arrayOfNulls(size)
        }
    }

    data class Image(val uri: Uri) : BugReportAttachment {
        override fun describeContents(): Int = 0

        override fun writeToParcel(parcel: Parcel, flags: Int) {
            parcel.writeString(uri.toString())
        }

        internal companion object CREATOR : Parcelable.Creator<Image> {
            override fun createFromParcel(parcel: Parcel): Image = Image(Uri.parse(parcel.readString()!!))

            override fun newArray(size: Int): Array<Image?> = arrayOfNulls(size)
        }
    }
}
