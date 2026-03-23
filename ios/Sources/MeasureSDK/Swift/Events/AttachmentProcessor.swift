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
    case gzipFileStorage
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
        let attachmentName: String = {
            switch attachmentType {
            case .layoutSnapshot: return "\(uuid).svg"
            case .layoutSnapshotJson: return "\(uuid)"
            default: return "\(uuid).png"
            }
        }()

        switch storageType {
        case .data:
            return MsrAttachment(name: attachmentName, type: attachmentType, size: Int64(image.count), id: uuid, bytes: image, path: nil)
        case .fileStorage:
            guard let fileURL = fileManager.saveFile(data: image, name: attachmentName, folderName: nil, directory: .documentDirectory) else {
                logger.internalLog(level: .error, message: "Failed to save compressed image to file storage.", error: nil, data: nil)
                return nil
            }
            return MsrAttachment(name: attachmentName, type: attachmentType, size: Int64(image.count), id: uuid, bytes: nil, path: fileURL.path)
        case .gzipFileStorage:
            guard let compressedData = image.gzipped(),
                  let fileURL = fileManager.saveFile(data: compressedData, name: attachmentName, folderName: nil, directory: .documentDirectory) else {
                logger.internalLog(level: .error, message: "Failed to gzip and save snapshot JSON to file storage.", error: nil, data: nil)
                return nil
            }
            return MsrAttachment(name: attachmentName, type: attachmentType, size: Int64(image.count), id: uuid, bytes: nil, path: fileURL.path)
        }
    }
}
