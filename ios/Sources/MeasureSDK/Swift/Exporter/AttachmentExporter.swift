//
//  AttachmentExporter.swift
//  Measure
//
//  Created by Adwin Ross on 10/10/25.
//

import Foundation
import UIKit

protocol AttachmentExporter {
    func enable()
    func disable()
    func onNewAttachmentsAvailable()
}

class BaseAttachmentExporter: AttachmentExporter {
    private let logger: Logger
    private let attachmentStore: AttachmentStore
    private let httpClient: HttpClient
    private let exportQueue: DispatchQueue
    private var isEnabled = AtomicBool(false)
    private var isExportInProgress: Bool = false
    private let configProvider: ConfigProvider
    private let baseOffset: Double = 0.5
    private let maxJitterTime: Double = 0.5
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    
    init(logger: Logger, attachmentStore: AttachmentStore, httpClient: HttpClient, exportQueue: DispatchQueue, configProvider: ConfigProvider) {
        self.logger = logger
        self.attachmentStore = attachmentStore
        self.httpClient = httpClient
        self.configProvider = configProvider
        self.exportQueue = exportQueue
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            logger.log(level: .info, message: "AttachmentExporter enabled.", error: nil, data: nil)
            exportQueue.async {
                self.startExport()
            }
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            logger.log(level: .info, message: "AttachmentExporter disabled.", error: nil, data: nil)
        }
    }

    func onNewAttachmentsAvailable() {
        exportQueue.async {
            self.startExport()
        }
    }

    private func startBackgroundTask() {
        guard self.backgroundTask == .invalid else { return }

        self.backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "AttachmentExport") {
            self.logger.log(level: .warning, message: "Background task for AttachmentExport expired.", error: nil, data: nil)
            self.endBackgroundTask()
        }
        self.logger.internalLog(level: .debug, message: "Started background task \(self.backgroundTask.rawValue).", error: nil, data: nil)
    }

    private func endBackgroundTask() {
        guard self.backgroundTask != .invalid else { return }
        
        self.logger.internalLog(level: .debug, message: "Ending background task \(self.backgroundTask.rawValue).", error: nil, data: nil)
        UIApplication.shared.endBackgroundTask(self.backgroundTask)
        self.backgroundTask = .invalid
    }

    private func startExport() {
        guard self.isEnabled.get(), !self.isExportInProgress else {
            return
        }

        self.isExportInProgress = true
        self.logger.internalLog(level: .debug, message: "Attachment export: starting export", error: nil, data: nil)

        self.startBackgroundTask()
        self.runUploadLoop()
    }
    
    private func runUploadLoop() {
        attachmentStore.getAttachmentsForUpload(batchSize: configProvider.maxAttachmentsInBatch) { [weak self] attachments in
            guard let self = self else { return }
            
            guard !attachments.isEmpty else {
                self.isExportInProgress = false
                self.logger.internalLog(level: .debug, message: "Attachment export: no attachments to upload, exiting", error: nil, data: nil)
                self.endBackgroundTask()
                return
            }

            self.processAttachments(attachments: attachments, index: 0)
        }
    }

    private func processAttachments(attachments: [MsrUploadAttachment], index: Int) {
        guard index < attachments.count else {
            if self.isEnabled.get() {
                self.runUploadLoop()
            } else {
                self.isExportInProgress = false
                self.logger.internalLog(level: .debug, message: "Attachment export: current batch finished, but disabled, so stopping.", error: nil, data: nil)
                self.endBackgroundTask()
            }
            return
        }
        
        let attachment = attachments[index]
        self.logger.internalLog(level: .debug, message: "Attachment export: uploading \(attachment.id)", error: nil, data: nil)

        self.uploadAttachment(attachment) { [weak self] success in
            guard let self = self else { return }

            if !success {
                self.isExportInProgress = false
                self.endBackgroundTask()
                return
            }

            let jitterMs = Double.random(in: 0...self.maxJitterTime)
            self.exportQueue.asyncAfter(deadline: .now() + self.baseOffset + jitterMs) {
                self.processAttachments(attachments: attachments, index: index + 1)
            }
        }
    }

    private func uploadAttachment(_ attachment: MsrUploadAttachment, completion: @escaping (Bool) -> Void) {
        guard let bytes = attachment.bytes,
              !bytes.isEmpty,
              let uploadUrlsString = attachment.uploadUrl,
              let uploadUrl = URL(string: uploadUrlsString),
              let headersData = attachment.headers,
              let headers = getHeaders(from: headersData) else {
            self.logger.internalLog(level: .error,
                                    message: "Attachment export: attachment data is empty or invalid for \(attachment.id), deleting attachment",
                                    error: nil,
                                    data: nil)
            self.attachmentStore.deleteAttachments(attachmentIds: [attachment.id]) {}
            completion(false)
            return
        }

        let contentType = attachment.type == .screenshot ? screenshotContentType : layoutSnapshotContentType
        let response = self.httpClient.uploadFile(url: uploadUrl,
                                                  method: .put,
                                                  contentType: contentType,
                                                  headers: headers,
                                                  fileData: bytes)
        completion(handleResponse(response, attachment: attachment))
    }

    private func getHeaders(from data: Data) -> [String: String]? {
        do {
            let jsonObject = try JSONSerialization.jsonObject(with: data, options: [])

            guard let headers = jsonObject as? [String: String] else {
                logger.log(level: .error, message: "Error: Deserialized object is not of type [String: String]", error: nil, data: nil)
                return nil
            }
            
            return headers
        } catch {
            logger.log(level: .error, message: "Error deserializing attachment headers", error: error, data: nil)
            return nil
        }
    }

    @discardableResult
    private func handleResponse(_ response: HttpResponse, attachment: MsrUploadAttachment) -> Bool {
        switch response {
        case .success:
            self.logger.internalLog(level: .debug, message: "Attachment export: successfully uploaded and deleted \(attachment.id)", error: nil, data: nil)
            self.attachmentStore.deleteAttachments(attachmentIds: [attachment.id]) {}
            return true
        case .error(let errorType):
            switch errorType {
            case .clientError(let code, _):
                self.logger.internalLog(level: .error, message: "Attachment export: upload failed for (\(attachment.id)), status code: \(code), deleting attachment", error: nil, data: nil)
                self.attachmentStore.deleteAttachments(attachmentIds: [attachment.id]) {}

                return false
            case .serverError(let code, _):
                self.logger.internalLog(level: .debug, message: "Attachment export: upload failed for (\(attachment.id), status code: \(code))", error: nil, data: nil)

                return false
            case .unknownError(_):
                self.logger.internalLog(level: .debug, message: "Attachment export: upload failed for (\(attachment.id))", error: nil, data: nil)

                return false
            case .rateLimitError(_):
                self.logger.internalLog(level: .debug, message: "Attachment export: upload failed for (\(attachment.id))", error: nil, data: nil)

                return false
            }
        }
    }
}
