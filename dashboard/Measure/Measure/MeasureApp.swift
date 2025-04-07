//
//  MeasureApp.swift
//  Measure
//
//  Created by Adwin Ross on 04/04/25.
//

import SwiftUI

@main
struct MeasureApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        Settings {} // Hide default Settings scene
    }
}
