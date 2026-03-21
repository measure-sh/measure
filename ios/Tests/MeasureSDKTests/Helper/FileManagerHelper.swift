//
//  FileManagerHelper.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

@testable import Measure
import Foundation
import XCTest

final class FileManagerHelper {
    func loadFileData(fileName: String, fileExtension: String) -> Data? {
        let testBundle = Bundle(for: type(of: self))
        guard let fileURL = testBundle.url(forResource: fileName, withExtension: fileExtension) else {
            XCTFail("File not found: \(fileName).\(fileExtension)")
            return nil
        }

        do {
            return try Data(contentsOf: fileURL)
        } catch {
            XCTFail("Error loading file data: \(error)")
            return nil
        }
    }

    func getException(fileName: String, fileExtension: String) -> Exception? {
        let testBundle = Bundle(for: type(of: self))
        guard let fileURL = testBundle.url(forResource: fileName, withExtension: fileExtension) else {
            XCTFail("JSON file not found")
            return nil
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            let exception = try decoder.decode(Exception.self, from: data)
            return exception
        } catch {
            XCTFail("Error reading JSON file: \(error)")
            return nil
        }
    }

    func getExceptionDict(fileName: String, fileExtension: String) -> [String: Any?]? {
        let testBundle = Bundle(for: type(of: self))
        guard let fileURL = testBundle.url(forResource: fileName, withExtension: fileExtension) else {
            XCTFail("JSON file not found")
            return nil
        }

        do {
            let data = try Data(contentsOf: fileURL)
            guard let jsonDictionary = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
                XCTFail("Could not convert JSON data to dictionary")
                return nil
            }
            return jsonDictionary
        } catch {
            XCTFail("Error processing JSON file: \(error)")
            return nil
        }
    }
}
