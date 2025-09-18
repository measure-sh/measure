//
//  LifecycleObserver.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 01/09/24.
//

import UIKit

/// A class that observes key application lifecycle events: background, foreground, active/inactive, and termination.
///
/// - Properties:
///   - `applicationDidEnterBackground`: Called when the application enters the background.
///   - `applicationWillEnterForeground`: Called when the application will enter the foreground.
///   - `applicationDidBecomeActive`: Called when the application becomes active.
///   - `applicationWillResignActive`: Called when the application is about to move from active to inactive state.
///   - `applicationWillTerminate`: Called when the application is about to terminate.
///
/// - Note: Make sure to retain an instance of this class as long as you need to observe the lifecycle events.
///
final class LifecycleObserver {
    var applicationDidEnterBackground: (() -> Void)?
    var applicationWillEnterForeground: (() -> Void)?
    var applicationDidBecomeActive: (() -> Void)?
    var applicationWillResignActive: (() -> Void)?
    var applicationWillTerminate: (() -> Void)?

    init() {
        setupObservers()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    private func setupObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onAppBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onAppForegrounded),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onAppDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onAppWillResignActive),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onAppWillTerminate),
            name: UIApplication.willTerminateNotification,
            object: nil
        )
    }

    @objc private func onAppBackground() {
        applicationDidEnterBackground?()
    }

    @objc private func onAppForegrounded() {
        applicationWillEnterForeground?()
    }

    @objc private func onAppDidBecomeActive() {
        applicationDidBecomeActive?()
    }

    @objc private func onAppWillResignActive() {
        applicationWillResignActive?()
    }

    @objc private func onAppWillTerminate() {
        applicationWillTerminate?()
    }
}
