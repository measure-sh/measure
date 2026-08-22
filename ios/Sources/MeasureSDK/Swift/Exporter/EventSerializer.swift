//
//  EventSerializer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 22/10/24.
//

import Foundation

struct EventSerializer {
    func getSerialisedEvent(for eventEntity: EventEntity) -> Data? {
        guard let type = EventType(rawValue: eventEntity.type) else {
            return nil
        }

        var writer = JSONWriter(capacity: (eventEntity.payloadData?.count ?? 0) + (eventEntity.attributes?.count ?? 0) + 512)
        writer.append(key: "id", unescapedIdentifier: eventEntity.id)
        writer.append(key: "session_id", unescapedIdentifier: eventEntity.sessionId)
        writer.append(key: "timestamp", unescapedIdentifier: eventEntity.timestamp)
        writer.append(key: "type", unescapedIdentifier: eventEntity.type)
        writer.append(key: "user_triggered", bool: eventEntity.userTriggered)
        writer.append(key: "attribute", rawJson: eventEntity.attributes)
        writer.append(key: "user_defined_attribute", rawJsonObject: eventEntity.userDefinedAttributes)
        writer.append(key: "attachments", rawJson: Self.serializeAttachments(eventEntity.attachments))

        writer.append(key: type.rawValue, rawJson: eventEntity.payloadData)

        return writer.finalize()
    }

    func serializeSpan(_ spanEntity: SpanEntity) -> Data? {
        var writer = JSONWriter(capacity: (spanEntity.attributes?.count ?? 0) + (spanEntity.checkpoints?.count ?? 0) + 512)
        writer.append(key: "name", string: spanEntity.name ?? "")
        writer.append(key: "trace_id", unescapedIdentifier: spanEntity.traceId ?? "")
        writer.append(key: "span_id", unescapedIdentifier: spanEntity.spanId)
        writer.append(key: "parent_id", optionalUnescapedIdentifier: spanEntity.parentId)
        writer.append(key: "session_id", unescapedIdentifier: spanEntity.sessionId ?? "")
        writer.append(key: "start_time", unescapedIdentifier: spanEntity.startTimeString)
        writer.append(key: "end_time", unescapedIdentifier: spanEntity.endTimeString)
        writer.append(key: "duration", int: spanEntity.duration)
        writer.append(key: "status", int: SpanStatus(rawValue: spanEntity.status ?? 0)?.rawValue ?? SpanStatus.unset.rawValue)
        writer.append(key: "attributes", rawJson: spanEntity.attributes)
        writer.append(key: "user_defined_attribute", rawJson: spanEntity.userDefinedAttrs)
        writer.append(key: "checkpoints", rawJson: spanEntity.checkpoints, fallback: Data("[]".utf8))

        return writer.finalize()
    }

    private static func serializeAttachments(_ attachments: [MsrAttachment]?) -> Data? {
        guard let attachments else { return nil }

        let serialized = attachments.map { attachment -> Data in
            var writer = JSONWriter(capacity: 128)
            writer.append(key: "id", unescapedIdentifier: attachment.id)
            writer.append(key: "name", unescapedIdentifier: attachment.name)
            writer.append(key: "type", unescapedIdentifier: attachment.type.rawValue)
            writer.append(key: "size", int: attachment.size)
            return writer.finalize()
        }

        return JSONWriter.array(of: serialized)
    }

    static func serializeUserDefinedAttribute(_ userDefinedAttribute: [String: AttributeValue]?) -> String? {
        guard let userDefinedAttribute = userDefinedAttribute else { return nil }

        let converted: [String: Any] = userDefinedAttribute.mapValues { $0.value }

        if let data = try? JSONSerialization.data(withJSONObject: converted, options: [.sortedKeys]),
           let jsonString = String(data: data, encoding: .utf8) {
            return jsonString
        }

        return nil
    }
}
