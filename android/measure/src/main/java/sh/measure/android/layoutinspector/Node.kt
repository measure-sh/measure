package sh.measure.android.layoutinspector

import android.annotation.SuppressLint
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import sh.measure.android.gestures.DetectedGesture

@Serializable
internal enum class ElementType {
    @SerialName("container")
    CONTAINER,

    @SerialName("text")
    TEXT,
}

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class Node(
    @SerialName("id")
    val id: String?,
    @SerialName("lb")
    val label: String,
    @SerialName("et")
    val type: ElementType,
    @SerialName("px")
    val positionX: Int,
    @SerialName("py")
    val positionY: Int,
    @SerialName("wd")
    val width: Int,
    @SerialName("ht")
    val height: Int,
    @SerialName("sc")
    val scrollable: Boolean = false,
    @SerialName("hl")
    val highlighted: Boolean = false,
    @SerialName("ch")
    val children: List<Node> = emptyList(),
    @kotlinx.serialization.Transient
    val gesture: DetectedGesture? = null,
)
