//
//  EventEntity.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/09/24.
//

import Foundation

struct EventEntity {
    let id: String
    let sessionId: String
    let timestamp: String
    let type: String
    let exception: Data?
    let attachments: Data?
    let attributes: Data?
    let gestureClick: Data?
    let gestureLongClick: Data?
    let gestureScroll: Data?
    let userTriggered: Bool
    let attachmentSize: Number
    let timestampInMillis: Number
    var batchId: String?

    init<T: Codable>(_ event: Event<T>) { // swiftlint:disable:this cyclomatic_complexity function_body_length
        self.id = event.id
        self.sessionId = event.sessionId
        self.timestamp = event.timestamp
        self.type = event.type.rawValue
        self.userTriggered = event.userTriggered
        self.timestampInMillis = event.timestampInMillis ?? 0
        self.attachmentSize = 0
        self.batchId = nil

        if let exception = event.data as? Exception {
            do {
                let data = try JSONEncoder().encode(exception)
                self.exception = data
            } catch {
                self.exception = nil
            }
        } else {
            self.exception = nil
        }

        if let gestureClick = event.data as? ClickData {
            do {
                let data = try JSONEncoder().encode(gestureClick)
                self.gestureClick = data
            } catch {
                self.gestureClick = nil
            }
        } else {
            self.gestureClick = nil
        }

        if let gestureLongClick = event.data as? LongClickData {
            do {
                let data = try JSONEncoder().encode(gestureLongClick)
                self.gestureLongClick = data
            } catch {
                self.gestureLongClick = nil
            }
        } else {
            self.gestureLongClick = nil
        }

        if let gestureScroll = event.data as? ScrollData {
            do {
                let data = try JSONEncoder().encode(gestureScroll)
                self.gestureScroll = data
            } catch {
                self.gestureScroll = nil
            }
        } else {
            self.gestureScroll = nil
        }

        if let attributes = event.attributes {
            do {
                let data = try JSONEncoder().encode(attributes)
                self.attributes = data
            } catch {
                self.attributes = nil
            }
        } else {
            self.attributes = nil
        }

        do {
            let data = try JSONEncoder().encode(event.attachments)
            self.attachments = data
        } catch {
            self.attachments = nil
        }
    }

    init(id: String,
         sessionId: String,
         timestamp: String,
         type: String,
         exception: Data?,
         attachments: Data?,
         attributes: Data?,
         gestureClick: Data?,
         gestureLongClick: Data?,
         gestureScroll: Data?,
         userTriggered: Bool,
         attachmentSize: Number,
         timestampInMillis: Number,
         batchId: String?) {
        self.id = id
        self.sessionId = sessionId
        self.timestamp = timestamp
        self.type = type
        self.exception = exception
        self.attachments = attachments
        self.attributes = attributes
        self.userTriggered = userTriggered
        self.gestureClick = gestureClick
        self.gestureLongClick = gestureLongClick
        self.gestureScroll = gestureScroll
        self.attachmentSize = attachmentSize
        self.timestampInMillis = timestampInMillis
        self.batchId = batchId
    }

    func getEvent<T: Codable>() -> Event<T> { // swiftlint:disable:this cyclomatic_complexity function_body_length
        var decodedData: T?
        let eventType = EventType(rawValue: type)
        switch eventType {
        case .exception:
            if let exceptionData = self.exception {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: exceptionData)
                } catch {
                    decodedData = nil
                }
            }
        case .gestureClick:
            if let gestureClickData = self.gestureClick {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: gestureClickData)
                } catch {
                    decodedData = nil
                }
            }
        case .gestureLongClick:
            if let gestureLongClickData = self.gestureLongClick {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: gestureLongClickData)
                } catch {
                    decodedData = nil
                }
            }
        case .gestureScroll:
            if let gestureScrollData = self.gestureScroll {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: gestureScrollData)
                } catch {
                    decodedData = nil
                }
            }
        case nil:
            decodedData = nil
        }

        let decodedAttachments: [Attachment]?
        if let attachmentData = self.attachments {
            do {
                decodedAttachments = try JSONDecoder().decode([Attachment].self, from: attachmentData)
            } catch {
                decodedAttachments = nil
            }
        } else {
            decodedAttachments = nil
        }

        let decodedAttributes: Attributes?
        if let attributeData = self.attributes {
            do {
                decodedAttributes = try JSONDecoder().decode(Attributes.self, from: attributeData)
            } catch {
                decodedAttributes = nil
            }
        } else {
            decodedAttributes = nil
        }

        return Event(id: self.id,
                     sessionId: self.sessionId,
                     timestamp: self.timestamp,
                     timestampInMillis: self.timestampInMillis,
                     type: EventType(rawValue: self.type) ?? .exception,
                     data: decodedData,
                     attachments: decodedAttachments ?? [Attachment](),
                     attributes: decodedAttributes,
                     userTriggered: self.userTriggered)
    }
}
