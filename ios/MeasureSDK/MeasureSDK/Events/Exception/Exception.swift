//
//  Exception.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/08/24.
//

import Foundation

struct Exception: Codable {
    
    /// A boolean indicating whether the exception was handled.
    let handled: Bool
    
    /// An array of `ExceptionDetail` objects representing the exceptions.
    let exceptions: [ExceptionDetail]
    
    /// A boolean indicating whether the app was in the foreground at the time of the exception.
    let foreground: Bool?
    
    /// An optional array of `Thread` objects representing the threads at the time of the exception.
    let threads: [Thread]?
    
    enum CodingKeys: String, CodingKey {
        case handled
        case exceptions
        case foreground
        case threads
    }
    
    init(handled: Bool, 
         exceptions: [ExceptionDetail],
         foreground: Bool?,
         threads: [Thread]?) {
        self.handled = handled
        self.exceptions = exceptions
        self.foreground = foreground
        self.threads = threads
    }
    
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        handled = try values.decode(Bool.self, forKey: .handled)
        exceptions = try values.decode([ExceptionDetail].self, forKey: .exceptions)
        foreground = try values.decodeIfPresent(Bool.self, forKey: .foreground)
        threads = try values.decodeIfPresent([Thread].self, forKey: .threads)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(handled, forKey: .handled)
        try container.encode(exceptions, forKey: .exceptions)
        try container.encodeIfPresent(foreground, forKey: .foreground)
        try container.encodeIfPresent(threads, forKey: .threads)
    }
}
