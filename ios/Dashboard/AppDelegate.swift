//
//  AppDelegate.swift
//  Dashboard
//
//  Created by Adwin Ross on 04/04/25.
//

import Cocoa
import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var popover: NSPopover!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create SwiftUI view
        let contentView = ContentView()
//        createCleanDashboardLogFileIfNeeded()

        // Create popover and host the SwiftUI view inside it
        popover = NSPopover()
        popover.contentSize = NSSize(width: 360, height: 600)
        popover.behavior = .transient
        popover.contentViewController = NSHostingController(rootView: contentView)

        // Create menu bar item
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "bolt.horizontal.fill", accessibilityDescription: "Measure Dashboard")

            // Toggle dashboard view on click
            button.action = #selector(togglePopover(_:))
        }
    }

    func createCleanDashboardLogFileIfNeeded() {
        let logsDir = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/MeasureSDK")
        
        let logFileURL = logsDir.appendingPathComponent("events.log")

        do {
            // ✅ Create the folder if needed
            try FileManager.default.createDirectory(at: logsDir, withIntermediateDirectories: true)
            
            // 💣 Overwrite any previous file
            if FileManager.default.fileExists(atPath: logFileURL.path) {
                try FileManager.default.removeItem(at: logFileURL)
                print("🗑️ Removed existing log file")
            }

            // ✍️ Create a fresh file
            let initialLine = "📝 Dashboard-created log file\n"
            try initialLine.write(to: logFileURL, atomically: true, encoding: .utf8)

            print("✅ Successfully created log file at: \(logFileURL.path)")
        } catch {
            print("❌ Failed to create log file: \(error.localizedDescription)")
        }
    }
    
    @objc func togglePopover(_ sender: AnyObject?) {
        if let button = statusItem.button {
            if popover.isShown {
                popover.performClose(sender)
            } else {
                popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            }
        }
    }
}
