package sh.measure.android.exporter

internal interface NetworkClient {
    fun enqueue(eventPacket: List<EventPacket>, attachmentPacket: List<AttachmentPacket>)
}

internal class NetworkClientImpl : NetworkClient {
    override fun enqueue(eventPacket: List<EventPacket>, attachmentPacket: List<AttachmentPacket>) {
        // Enqueue the event and attachment packets to be sent to the server
    }
}
