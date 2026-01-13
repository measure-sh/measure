//
//  MockSignalSampler.swift
//  Measure
//
//  Created by Adwin Ross on 24/11/25.
//

import Foundation
@testable import Measure

final class MockSignalSampler: SignalSampler {
    var shouldTrackLaunchEventsReturnValue: Bool = false
    var shouldMarkSessionForExportReturnValue: Bool = false
    var shouldTrackTraceReturnValue: Bool = false
    var shouldTrackJourneyEventsReturnValue: Bool = false
    var shouldSampleTraceReturnValue: Bool = false

    func shouldMarkSessionForExport() -> Bool {
        return shouldMarkSessionForExportReturnValue
    }

    func shouldTrackTrace() -> Bool {
        return shouldTrackTraceReturnValue
    }

    func shouldTrackJourneyEvents() -> Bool {
        return shouldTrackJourneyEventsReturnValue
    }

    func shouldTrackLaunchEvents() -> Bool {
        return shouldTrackLaunchEventsReturnValue
    }
    
    func shouldSampleTrace(_ traceId: String) -> Bool {
        return shouldSampleTraceReturnValue
    }
}
