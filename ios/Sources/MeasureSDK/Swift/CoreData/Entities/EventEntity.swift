//
//  EventEntity.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/09/24.
//

import Foundation

struct EventEntity { // swiftlint:disable:this type_body_length
    let id: String
    let sessionId: String
    let timestamp: String
    let type: String
    let exception: Data?
    let attachments: Data?
    let attributes: Data?
    let userDefinedAttributes: String?
    let gestureClick: Data?
    let gestureLongClick: Data?
    let gestureScroll: Data?
    let lifecycleApp: Data?
    let lifecycleViewController: Data?
    let lifecycleSwiftUI: Data?
    let cpuUsage: Data?
    let memoryUsage: Data?
    let coldLaunch: Data?
    let warmLaunch: Data?
    let hotLaunch: Data?
    let networkChange: Data?
    let screenView: Data?
    let userTriggered: Bool
    let attachmentSize: Number
    let timestampInMillis: Number
    var batchId: String?
    let http: Data?
    let customEvent: Data?
    var needsReporting: Bool
    let bugReport: Data?

    init<T: Codable>(_ event: Event<T>, needsReporting: Bool) { // swiftlint:disable:this cyclomatic_complexity function_body_length
        self.id = event.id
        self.sessionId = event.sessionId
        self.timestamp = event.timestamp
        self.type = event.type.rawValue
        self.userTriggered = event.userTriggered
        self.timestampInMillis = event.timestampInMillis ?? 0
        self.attachmentSize = event.attachments?.reduce(0) { $0 + $1.size } ?? 0
        self.batchId = nil
        self.userDefinedAttributes = event.userDefinedAttributes
        self.needsReporting = needsReporting

        if let exception = event.exception {
            do {
                let data = try JSONEncoder().encode(exception)
                self.exception = data
            } catch {
                self.exception = nil
            }
        } else {
            self.exception = nil
        }

        if let gestureClick = event.gestureClick {
            do {
                let data = try JSONEncoder().encode(gestureClick)
                self.gestureClick = data
            } catch {
                self.gestureClick = nil
            }
        } else {
            self.gestureClick = nil
        }

        if let gestureLongClick = event.gestureLongClick {
            do {
                let data = try JSONEncoder().encode(gestureLongClick)
                self.gestureLongClick = data
            } catch {
                self.gestureLongClick = nil
            }
        } else {
            self.gestureLongClick = nil
        }

        if let gestureScroll = event.gestureScroll {
            do {
                let data = try JSONEncoder().encode(gestureScroll)
                self.gestureScroll = data
            } catch {
                self.gestureScroll = nil
            }
        } else {
            self.gestureScroll = nil
        }

        if let lifecycleApp = event.lifecycleApp {
            do {
                let data = try JSONEncoder().encode(lifecycleApp)
                self.lifecycleApp = data
            } catch {
                self.lifecycleApp = nil
            }
        } else {
            self.lifecycleApp = nil
        }

        if let lifecycleViewController = event.lifecycleViewController {
            do {
                let data = try JSONEncoder().encode(lifecycleViewController)
                self.lifecycleViewController = data
            } catch {
                self.lifecycleViewController = nil
            }
        } else {
            self.lifecycleViewController = nil
        }

        if let lifecycleSwiftUI = event.lifecycleSwiftUI {
            do {
                let data = try JSONEncoder().encode(lifecycleSwiftUI)
                self.lifecycleSwiftUI = data
            } catch {
                self.lifecycleSwiftUI = nil
            }
        } else {
            self.lifecycleSwiftUI = nil
        }

        if let cpuUsage = event.cpuUsage {
            do {
                let data = try JSONEncoder().encode(cpuUsage)
                self.cpuUsage = data
            } catch {
                self.cpuUsage = nil
            }
        } else {
            self.cpuUsage = nil
        }

        if let memoryUsage = event.memoryUsageAbsolute {
            do {
                let data = try JSONEncoder().encode(memoryUsage)
                self.memoryUsage = data
            } catch {
                self.memoryUsage = nil
            }
        } else {
            self.memoryUsage = nil
        }

        if let coldLaunch = event.coldLaunch {
            do {
                let data = try JSONEncoder().encode(coldLaunch)
                self.coldLaunch = data
            } catch {
                self.coldLaunch = nil
            }
        } else {
            self.coldLaunch = nil
        }

        if let warmLaunch = event.warmLaunch {
            do {
                let data = try JSONEncoder().encode(warmLaunch)
                self.warmLaunch = data
            } catch {
                self.warmLaunch = nil
            }
        } else {
            self.warmLaunch = nil
        }

        if let hotLaunch = event.hotLaunch {
            do {
                let data = try JSONEncoder().encode(hotLaunch)
                self.hotLaunch = data
            } catch {
                self.hotLaunch = nil
            }
        } else {
            self.hotLaunch = nil
        }

        if let http = event.http {
            do {
                let data = try JSONEncoder().encode(http)
                self.http = data
            } catch {
                self.http = nil
            }
        } else {
            self.http = nil
        }

        if let networkChange = event.networkChange {
            do {
                let data = try JSONEncoder().encode(networkChange)
                self.networkChange = data
            } catch {
                self.networkChange = nil
            }
        } else {
            self.networkChange = nil
        }

        if let customEvent = event.custom {
            do {
                let data = try JSONEncoder().encode(customEvent)
                self.customEvent = data
            } catch {
                self.customEvent = nil
            }
        } else {
            self.customEvent = nil
        }

        if let screenView = event.screenView {
            do {
                let data = try JSONEncoder().encode(screenView)
                self.screenView = data
            } catch {
                self.screenView = nil
            }
        } else {
            self.screenView = nil
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

        if let attachments = event.attachments {
            do {
                let data = try JSONEncoder().encode(attachments)
                self.attachments = data
            } catch {
                self.attachments = nil
            }
        } else {
            self.attachments = nil
        }

        if let bugReport = event.bugReport {
            do {
                let data = try JSONEncoder().encode(bugReport)
                self.bugReport = data
            } catch {
                self.bugReport = nil
            }
        } else {
            self.bugReport = nil
        }
    }

    init(id: String,
         sessionId: String,
         timestamp: String,
         type: String,
         exception: Data?,
         attachments: Data?,
         attributes: Data?,
         userDefinedAttributes: String?,
         gestureClick: Data?,
         gestureLongClick: Data?,
         gestureScroll: Data?,
         userTriggered: Bool,
         attachmentSize: Number,
         timestampInMillis: Number,
         batchId: String?,
         lifecycleApp: Data?,
         lifecycleViewController: Data?,
         lifecycleSwiftUI: Data?,
         cpuUsage: Data?,
         memoryUsage: Data?,
         coldLaunch: Data?,
         warmLaunch: Data?,
         hotLaunch: Data?,
         http: Data?,
         networkChange: Data?,
         customEvent: Data?,
         screenView: Data?,
         bugReport: Data?,
         needsReporting: Bool) {
        self.id = id
        self.sessionId = sessionId
        self.timestamp = timestamp
        self.type = type
        self.exception = exception
        self.attachments = attachments
        self.attributes = attributes
        self.userDefinedAttributes = userDefinedAttributes
        self.userTriggered = userTriggered
        self.gestureClick = gestureClick
        self.gestureLongClick = gestureLongClick
        self.gestureScroll = gestureScroll
        self.attachmentSize = attachmentSize
        self.timestampInMillis = timestampInMillis
        self.batchId = batchId
        self.lifecycleApp = lifecycleApp
        self.lifecycleViewController = lifecycleViewController
        self.lifecycleSwiftUI = lifecycleSwiftUI
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.coldLaunch = coldLaunch
        self.warmLaunch = warmLaunch
        self.hotLaunch = hotLaunch
        self.http = http
        self.networkChange = networkChange
        self.customEvent = customEvent
        self.screenView = screenView
        self.needsReporting = needsReporting
        self.bugReport = bugReport
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
        case .lifecycleApp:
            if let lifecycleAppData = self.lifecycleApp {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: lifecycleAppData)
                } catch {
                    decodedData = nil
                }
            }
        case .lifecycleViewController:
            if let lifecycleViewControllerData = self.lifecycleViewController {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: lifecycleViewControllerData)
                } catch {
                    decodedData = nil
                }
            }
        case .lifecycleSwiftUI:
            if let lifecycleSwiftUIData = self.lifecycleSwiftUI {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: lifecycleSwiftUIData)
                } catch {
                    decodedData = nil
                }
            }
        case .cpuUsage:
            if let cpuUsageData = self.cpuUsage {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: cpuUsageData)
                } catch {
                    decodedData = nil
                }
            }
        case .memoryUsageAbsolute:
            if let memoryUsageData = self.memoryUsage {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: memoryUsageData)
                } catch {
                    decodedData = nil
                }
            }
        case .coldLaunch:
            if let coldLaunchData = self.coldLaunch {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: coldLaunchData)
                } catch {
                    decodedData = nil
                }
            }
        case .warmLaunch:
            if let warmLaunchData = self.warmLaunch {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: warmLaunchData)
                } catch {
                    decodedData = nil
                }
            }
        case .hotLaunch:
            if let hotLaunchData = self.hotLaunch {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: hotLaunchData)
                } catch {
                    decodedData = nil
                }
            }
        case .http:
            if let httpData = self.http {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: httpData)
                } catch {
                    decodedData = nil
                }
            }
        case .networkChange:
            if let networkChangeData = self.networkChange {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: networkChangeData)
                } catch {
                    decodedData = nil
                }
            }
        case .custom:
            if let customEventData = self.customEvent {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: customEventData)
                } catch {
                    decodedData = nil
                }
            }
        case .screenView:
            if let screenViewData = self.screenView {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: screenViewData)
                } catch {
                    decodedData = nil
                }
            }
        case .bugReport:
            if let bugReportData = self.bugReport {
                do {
                    decodedData = try JSONDecoder().decode(T.self, from: bugReportData)
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
                     attachments: decodedAttachments,
                     attributes: decodedAttributes,
                     userTriggered: self.userTriggered,
                     userDefinedAttributes: self.userDefinedAttributes)
    }

    func getAttachments() -> [Attachment]? {
        if let attachmentData = self.attachments {
            do {
                return try JSONDecoder().decode([Attachment].self, from: attachmentData)
            } catch {
                return nil
            }
        } else {
            return nil
        }
    }
} // swiftlint:disable:this file_length
