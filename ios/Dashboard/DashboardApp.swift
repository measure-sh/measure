//
//  DashboardApp.swift
//  Dashboard
//
//  Created by Adwin Ross on 04/04/25.
//

import SwiftUI

@main
struct DashboardApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        Settings {} // Hides default settings window
    }
}
