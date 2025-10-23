package sh.measure.android.bugreport

import android.os.Parcel
import android.os.Parcelable

internal data class ParcelableAttachment(
    val name: String,
    val path: String,
) : Parcelable {

    override fun writeToParcel(parcel: Parcel, flags: Int) {
        parcel.writeString(name)
        parcel.writeString(path)
    }

    override fun describeContents(): Int = 0

    internal companion object CREATOR : Parcelable.Creator<ParcelableAttachment> {
        override fun createFromParcel(parcel: Parcel): ParcelableAttachment = ParcelableAttachment(
            parcel.readString()!!,
            parcel.readString()!!,
        )

        override fun newArray(size: Int): Array<ParcelableAttachment?> = arrayOfNulls(size)
    }
}
