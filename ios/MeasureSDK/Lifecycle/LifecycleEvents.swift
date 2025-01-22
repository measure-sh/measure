//
//  LifecycleEvents.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 27/10/24.
//

import Foundation

enum AppLifecycleType: String, Codable {
    case foreground
    case background
    case terminated
}

struct ApplicationLifecycleData: Codable {
    let type: AppLifecycleType
}

@objc public enum VCLifecycleEventType: Int, Codable {
    case viewDidLoad = 0
    case viewWillAppear = 1
    case viewDidAppear = 2
    case viewWillDisappear = 3
    case viewDidDisappear = 4
    case didReceiveMemoryWarning = 5
    case initWithNibName = 6
    case initWithCoder = 7
    case loadView = 8
    case vcDeinit = 9

    var stringValue: String {
        switch self {
        case .viewDidLoad: return "viewDidLoad"
        case .viewDidAppear: return "viewDidAppear"
        case .viewDidDisappear: return "viewDidDisappear"
        case .didReceiveMemoryWarning: return "didReceiveMemoryWarning"
        case .initWithNibName: return "initWithNibName"
        case .initWithCoder: return "initWithCoder"
        case .loadView: return "loadView"
        case .vcDeinit: return "vcDeinit"
        case .viewWillAppear: return "viewWillAppear"
        case .viewWillDisappear: return "viewWillDisappear"
        }
    }
}

struct VCLifecycleData: Codable {
    let type: String
    let className: String

    enum CodingKeys: String, CodingKey {
        case type
        case className = "class_name"
    }
}

enum SwiftUILifecycleType: String, Codable {
    case onAppear = "on_appear"
    case onDisappear = "on_disappear"
}

struct SwiftUILifecycleData: Codable {
    let type: SwiftUILifecycleType
    let className: String

    enum CodingKeys: String, CodingKey {
        case type
        case className = "class_name"
    }
}
