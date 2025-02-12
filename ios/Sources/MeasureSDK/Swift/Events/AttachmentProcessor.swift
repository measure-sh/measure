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
    func getAttachmentObject(for image: Data, name: String, storageType: AttachmentStorageType, attachmentType: AttachmentType) -> Attachment?
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
                             name: String,
                             storageType: AttachmentStorageType,
                             attachmentType: AttachmentType) -> Attachment? {
        let uuid = idProvider.createId()
        switch storageType {
        case .data:
            return Attachment(name: name, type: attachmentType, size: Int64(image.count), id: uuid, bytes: image, path: nil)
        case .fileStorage:
            guard let fileURL = fileManager.saveFile(data: image, name: name, folderName: "attachments", directory: .documentDirectory) else {
                logger.internalLog(level: .error, message: "Failed to save compressed image to file storage.", error: nil, data: nil)
                return nil
            }
            return Attachment(name: name, type: attachmentType, size: Int64(image.count), id: uuid, bytes: nil, path: fileURL.path)
        }
    }
}
