//
//  AttachmentProcessor.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/01/25.
//

import Foundation

enum AttachmentStorageType {
    case data
    case fileStorage
}

protocol AttachmentProcessor {
    func getAttachmentObject(for image: Data, storageType: AttachmentStorageType, attachmentType: AttachmentType) -> MsrAttachment?
}

final class BaseAttachmentProcessor: AttachmentProcessor {
    private let fileManager: SystemFileManager
    private let logger: Logger
    private let idProvider: IdProvider

    init(logger: Logger, fileManager: SystemFileManager, idProvider: IdProvider) {
        self.fileManager = fileManager
        self.logger = logger
        self.idProvider = idProvider
    }

    func getAttachmentObject(for image: Data,
                             storageType: AttachmentStorageType,
                             attachmentType: AttachmentType) -> MsrAttachment? {
        let uuid = idProvider.uuid()
        let attachmentName = "\(uuid)\(attachmentType == .layoutSnapshot ? ".svg" : ".png")"
        switch storageType {
        case .data:
            return MsrAttachment(name: attachmentName, type: attachmentType, size: Int64(image.count), id: uuid, bytes: image, path: nil)
        case .fileStorage:
            guard let fileURL = fileManager.saveFile(data: image, name: attachmentName, folderName: "attachments", directory: .documentDirectory) else {
                logger.internalLog(level: .error, message: "Failed to save compressed image to file storage.", error: nil, data: nil)
                return nil
            }
            return MsrAttachment(name: attachmentName, type: attachmentType, size: Int64(image.count), id: uuid, bytes: nil, path: fileURL.path)
        }
    }
}
