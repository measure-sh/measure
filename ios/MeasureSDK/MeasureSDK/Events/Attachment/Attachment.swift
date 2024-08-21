//
//  Attachment.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/08/24.
//

import Foundation

struct Attachment: Codable {

    /// The unique identifier for the attachment.
    let id: String
    
    /// The name of the attachment.
    let name: String
    
    /// The type of the attachment. One of the following:
    /// - "screenshot"
    /// - "android_method_trace"
    let type: String
    
    init(id: String, name: String, type: String) {
        self.id = id
        self.name = name
        self.type = type
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case type
    }
    
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try values.decode(String.self, forKey: .id)
        name = try values.decode(String.self, forKey: .name)
        type = try values.decode(String.self, forKey: .type)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(type, forKey: .type)
    }
}
