//
//  CoreDataMigrationTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/26.
//

import CoreData
@testable import Measure
import XCTest

/// Covers upgrading an existing on-disk store to the current model version.
///
/// `MockCoreDataManager` uses an in-memory store, so nothing else in the suite exercises
/// migration. These tests use a real SQLite store on disk, because an upgrade install is the only
/// place a schema change can lose user data.
final class CoreDataMigrationTests: XCTestCase {
    private var storeURL: URL!

    override func setUpWithError() throws {
        try super.setUpWithError()
        storeURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("MeasureMigrationTests-\(UUID().uuidString)")
            .appendingPathComponent("MeasureModel.sqlite")
        try FileManager.default.createDirectory(at: storeURL.deletingLastPathComponent(),
                                                withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        if let directory = storeURL?.deletingLastPathComponent() {
            try? FileManager.default.removeItem(at: directory)
        }
        storeURL = nil
        try super.tearDownWithError()
    }

    // MARK: - Helpers

    private func momdURL() throws -> URL {
        let bundle = Bundle(for: type(of: self))
        return try XCTUnwrap(bundle.url(forResource: "MeasureModel", withExtension: "momd"),
                             "MeasureModel.momd is missing from the test bundle.")
    }

    /// Loads a specific model version out of the compiled `.momd`.
    private func model(named name: String) throws -> NSManagedObjectModel {
        let url = try momdURL().appendingPathComponent("\(name).mom")
        return try XCTUnwrap(NSManagedObjectModel(contentsOf: url), "Could not load model \(name).")
    }

    /// Loads whichever version the `.momd` declares current — the same call `CoreDataManager` makes.
    private func currentModel() throws -> NSManagedObjectModel {
        try XCTUnwrap(NSManagedObjectModel(contentsOf: momdURL()), "Could not load the current model.")
    }

    private func loadContainer(model: NSManagedObjectModel, allowMigration: Bool) throws -> NSPersistentContainer {
        let container = NSPersistentContainer(name: "MeasureModel", managedObjectModel: model)
        let description = NSPersistentStoreDescription(url: storeURL)
        description.type = NSSQLiteStoreType
        description.shouldMigrateStoreAutomatically = allowMigration
        description.shouldInferMappingModelAutomatically = allowMigration
        container.persistentStoreDescriptions = [description]

        var loadError: Error?
        container.loadPersistentStores { _, error in loadError = error }
        if let loadError {
            throw loadError
        }
        return container
    }

    private func unload(_ container: NSPersistentContainer) throws {
        for store in container.persistentStoreCoordinator.persistentStores {
            try container.persistentStoreCoordinator.remove(store)
        }
    }

    /// Writes one event using only attributes that exist in the given model version.
    private func seedEvent(in container: NSPersistentContainer, id: String, sessionId: String) throws {
        let context = container.viewContext
        let event = NSEntityDescription.insertNewObject(forEntityName: "EventOb", into: context)
        event.setValue(id, forKey: "id")
        event.setValue(sessionId, forKey: "sessionId")
        event.setValue("2026-09-21T10:00:00Z", forKey: "timestamp")
        event.setValue(Int64(1_727_272_496_000), forKey: "timestampInMillis")
        event.setValue("custom", forKey: "type")
        event.setValue(true, forKey: "needsReporting")
        event.setValue(false, forKey: "userTriggered")
        event.setValue(Data("{\"name\":\"checkout\"}".utf8), forKey: "customEvent")
        try context.save()
    }

    private func fetchEvents(in container: NSPersistentContainer) throws -> [NSManagedObject] {
        let request = NSFetchRequest<NSManagedObject>(entityName: "EventOb")
        request.sortDescriptors = [NSSortDescriptor(key: "id", ascending: true)]
        return try container.viewContext.fetch(request)
    }

    // MARK: - Tests

    /// Guards the `.xccurrentversion` / `XCVersionGroup` pairing. If the project's `currentVersion`
    /// is left pointing at an older model, the SDK silently runs against that older schema and only
    /// fails at runtime, on the first write to a newly added column.
    func testCurrentModelIsTheOneWithAppHangColumns() throws {
        let entity = try XCTUnwrap(currentModel().entitiesByName["EventOb"],
                                   "The current model has no EventOb entity.")
        let attributes = entity.attributesByName

        let appHang = try XCTUnwrap(attributes["appHang"], "The current model must carry EventOb.appHang.")
        let pending = try XCTUnwrap(attributes["pendingResolution"], "The current model must carry EventOb.pendingResolution.")

        XCTAssertEqual(appHang.attributeType.rawValue, NSAttributeType.binaryDataAttributeType.rawValue)
        XCTAssertTrue(appHang.isOptional)

        XCTAssertEqual(pending.attributeType.rawValue, NSAttributeType.booleanAttributeType.rawValue)
        XCTAssertFalse(pending.isOptional,
                       "pendingResolution is non-optional, so it needs a default for lightweight migration.")
        XCTAssertNotNil(pending.defaultValue,
                        "Without a default value, migrating an existing store would fail.")
    }

    /// The upgrade path: a store written by the shipped version, opened by this one.
    func testMigratingV2StoreToCurrentModelPreservesEvents() throws {
        let v2 = try loadContainer(model: try model(named: "MeasureModelV2"), allowMigration: false)
        try seedEvent(in: v2, id: "event-1", sessionId: "session-1")
        try seedEvent(in: v2, id: "event-2", sessionId: "session-2")
        try unload(v2)

        let migrated = try loadContainer(model: try currentModel(), allowMigration: true)
        defer { try? unload(migrated) }

        let events = try fetchEvents(in: migrated)
        XCTAssertEqual(events.count, 2, "Migration must not drop existing events.")

        let first = try XCTUnwrap(events.first)
        XCTAssertEqual(first.value(forKey: "id") as? String, "event-1")
        XCTAssertEqual(first.value(forKey: "sessionId") as? String, "session-1")
        XCTAssertEqual(first.value(forKey: "type") as? String, "custom")
        XCTAssertEqual(first.value(forKey: "timestampInMillis") as? Int64, 1_727_272_496_000)
        XCTAssertEqual(first.value(forKey: "needsReporting") as? Bool, true)
        XCTAssertEqual(first.value(forKey: "customEvent") as? Data, Data("{\"name\":\"checkout\"}".utf8))
    }

    /// Migrated rows predate app hangs, so they must not look like unresolved ones — otherwise the
    /// export queries would drop every event carried over from the previous install.
    func testMigratedEventsAreNotTreatedAsUnresolvedAppHangs() throws {
        let v2 = try loadContainer(model: try model(named: "MeasureModelV2"), allowMigration: false)
        try seedEvent(in: v2, id: "event-1", sessionId: "session-1")
        try unload(v2)

        let migrated = try loadContainer(model: try currentModel(), allowMigration: true)
        defer { try? unload(migrated) }

        let event = try XCTUnwrap(try fetchEvents(in: migrated).first)
        XCTAssertEqual(event.value(forKey: "pendingResolution") as? Bool, false)
        XCTAssertNil(event.value(forKey: "appHang"))
    }

    /// The store the current model writes must still be readable by the code that reads it back,
    /// including the two new columns.
    func testAppHangColumnsPersistAcrossReopen() throws {
        let payload = Data("{\"state\":\"killed\"}".utf8)

        let container = try loadContainer(model: try currentModel(), allowMigration: true)
        let context = container.viewContext
        let event = NSEntityDescription.insertNewObject(forEntityName: "EventOb", into: context)
        event.setValue("event-1", forKey: "id")
        event.setValue("session-1", forKey: "sessionId")
        event.setValue("2026-09-21T10:00:00Z", forKey: "timestamp")
        event.setValue(Int64(1), forKey: "timestampInMillis")
        event.setValue("app_hang", forKey: "type")
        event.setValue(payload, forKey: "appHang")
        event.setValue(true, forKey: "pendingResolution")
        try context.save()
        try unload(container)

        let reopened = try loadContainer(model: try currentModel(), allowMigration: true)
        defer { try? unload(reopened) }

        let stored = try XCTUnwrap(try fetchEvents(in: reopened).first)
        XCTAssertEqual(stored.value(forKey: "appHang") as? Data, payload)
        XCTAssertEqual(stored.value(forKey: "pendingResolution") as? Bool, true)
    }
}
