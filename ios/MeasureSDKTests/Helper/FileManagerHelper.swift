//
//  FileManagerHelper.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import CrashReporter
@testable import MeasureSDK
import Foundation

final class FileManagerHelper {
    func loadFileData(fileName: String, fileExtension: String) -> Data? {
        let testBundle = Bundle(for: type(of: self))
        guard let fileURL = testBundle.url(forResource: fileName, withExtension: fileExtension) else {
            print("File not found: \(fileName).\(fileExtension)")
            return nil
        }

        do {
            return try Data(contentsOf: fileURL)
        } catch {
            print("Error loading file data: \(error)")
            return nil
        }
    }

    func getCrashReport(fileName: String, fileExtension: String) -> BaseCrashReport? {
        guard let fileData = loadFileData(fileName: fileName, fileExtension: fileExtension) else {
            return nil
        }

        do {
            let plCrashReport = try PLCrashReport(data: fileData)
            return BaseCrashReport(plCrashReport)
        } catch {
            print("Error creating BaseCrashReport: \(error)")
            return nil
        }
    }

    func getException(fileName: String, fileExtension: String) -> Exception? {
        let testBundle = Bundle(for: type(of: self))
        guard let fileURL = testBundle.url(forResource: fileName, withExtension: fileExtension) else {
            print("JSON file not found")
            return nil
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            let exception = try decoder.decode(Exception.self, from: data)
            return exception
        } catch {
            print("Error reading JSON file: \(error)")
            return nil
        }
    }
}
