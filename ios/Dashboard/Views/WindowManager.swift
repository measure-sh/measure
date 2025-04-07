//
//  WindowManager.swift
//  Dashboard
//
//  Created by Adwin Ross on 04/04/25.
//

import Cocoa
import SwiftUI

class WindowManager {
    private var window: NSWindow?

    func showDetailWindow(loader: EventLoader) {
        if window == nil {
            let detailView = DetailView(loader: loader)
            let hostingController = NSHostingController(rootView: detailView)

            let newWindow = NSWindow(contentViewController: hostingController)
            newWindow.title = "Measure Event Detail"
            newWindow.setContentSize(NSSize(width: 600, height: 400))
            newWindow.styleMask.insert([.titled, .closable, .miniaturizable, .resizable])
            newWindow.isReleasedWhenClosed = false
            newWindow.center()
            newWindow.makeKeyAndOrderFront(nil)

            self.window = newWindow
        } else {
            window?.makeKeyAndOrderFront(nil)
        }
    }
}
