package sh.measure.android.attachment

/**
 * The type of attachment. Changing this will require a server side change as well.
 * The server validates the type of attachment before storing it.
 */
internal object AttachmentType {
    const val METHOD_TRACE = "android_method_trace"
}