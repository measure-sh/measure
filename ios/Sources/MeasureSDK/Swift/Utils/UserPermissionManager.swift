//
//  UserPermissionManager.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/02/25.
//

import Photos

protocol UserPermissionManager {
    func isPhotoLibraryUsagePermissionAvailable() -> Bool
}

final class BaseUserPermissionManager: UserPermissionManager {
    func isPhotoLibraryUsagePermissionAvailable() -> Bool {
        let status = PHPhotoLibrary.authorizationStatus()
        if #available(iOS 14, *) {
            return status == .authorized || status == .limited
        } else {
            return status == .authorized
        }
    }
}
