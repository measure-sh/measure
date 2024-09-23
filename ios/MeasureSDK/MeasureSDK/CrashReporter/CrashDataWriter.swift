//
//  CrashDataWriter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 19/09/24.
//

import Foundation

/// A singleton class responsible for writing crash data to a persistent store.
final class CrashDataWriter {
    static let shared = CrashDataWriter()
    private var crashDataPersistence: CrashDataPersistence?

    private init() {}

    func setCrashDataPersistence(_ crashDataPersistence: CrashDataPersistence) {
        self.crashDataPersistence = crashDataPersistence
    }

    func writeCrashData() {
        if let crashDataPersistence = self.crashDataPersistence {
            crashDataPersistence.writeCrashData()
        }
    }
}
