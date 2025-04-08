import Foundation

/// A thread-safe implementation of `Span`.
class MsrSpan: InternalSpan {
    private let logger: Logger
    private let timeProvider: TimeProvider
//    private let spanProcessor: SpanProcessor
    private let lock = NSLock()

    let isSampled: Bool
    var name: String
    let spanId: String
    var traceId: String
    var parentId: String?
    let sessionId: String
    let startTime: Number

    private var status: SpanStatus = .unset
    private var endTime: Number = 0
    private var hasEndedState: EndState = .notEnded
    private(set) var checkpoints: [Checkpoint] = []
    private(set) var attributes: [String: Any] = [:]
    private var userDefinedAttrs: [String: Any] = [:]

    private enum EndState {
        case notEnded
        case ending
        case ended
    }

    init(logger: Logger,
         timeProvider: TimeProvider,
         isSampled: Bool,
         name: String,
         spanId: String,
         traceId: String,
         parentId: String?,
         sessionId: String,
         startTime: Number) {
        self.logger = logger
        self.timeProvider = timeProvider
        self.isSampled = isSampled
        self.name = name
        self.spanId = spanId
        self.traceId = traceId
        self.parentId = parentId
        self.sessionId = sessionId
        self.startTime = startTime
    }

    static func startSpan(name: String, // swiftlint:disable:this function_parameter_count
                          logger: Logger,
                          timeProvider: TimeProvider,
                          sessionManager: SessionManager,
                          idProvider: IdProvider,
                          traceSampler: TraceSampler,
                          parentSpan: Span?,
                          timestamp: Number? = nil) -> Span {
        let startTime = timestamp ?? timeProvider.now()
        let spanId = idProvider.spanId()
        let traceId = parentSpan?.traceId ?? idProvider.traceId()
        let sessionId = sessionManager.sessionId
        let isSampled = parentSpan?.isSampled ?? traceSampler.shouldSample()

        let span = MsrSpan(logger: logger,
                          timeProvider: timeProvider,
                          isSampled: isSampled,
                          name: name,
                          spanId: spanId,
                          traceId: traceId,
                          parentId: parentSpan?.spanId,
                          sessionId: sessionId,
                          startTime: startTime)

//        spanProcessor.onStart(span)
        return span
    }

    func getStatus() -> SpanStatus {
        lock.lock()
        defer { lock.unlock() }
        return status
    }

    func getAttributesMap() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return attributes
    }

    func getUserDefinedAttrs() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return userDefinedAttrs
    }

    func setInternalAttribute(_ attribute: (String, Any)) {
        lock.lock()
        defer { lock.unlock() }
        attributes[attribute.0] = attribute.1
    }

    @discardableResult
    func setStatus(_ status: SpanStatus) -> Span {
        lock.lock()
        defer { lock.unlock() }
        if hasEndedState == .notEnded {
            self.status = status
        }
        return self
    }

    @discardableResult
    func setParent(_ parentSpan: Span) -> Span {
        lock.lock()
        defer { lock.unlock() }
        if hasEndedState == .notEnded {
            parentId = parentSpan.spanId
            traceId = parentSpan.traceId
        }
        return self
    }

    @discardableResult
    func setCheckpoint(_ name: String) -> Span {
        lock.lock()
        defer { lock.unlock() }
        if hasEndedState == .notEnded {
            let checkpoint = Checkpoint(name: name, timestamp: timeProvider.now())
            checkpoints.append(checkpoint)
        }
        return self
    }

    @discardableResult
    func setName(_ name: String) -> Span {
        lock.lock()
        defer { lock.unlock() }
        if hasEndedState == .notEnded {
            self.name = name
        }
        return self
    }

    @discardableResult
    func setAttribute(_ key: String, value: String) -> Span {
        lock.lock()
        defer { lock.unlock() }
        if hasEndedState == .notEnded {
            userDefinedAttrs[key] = value
        }
        return self
    }

    @discardableResult
    func setAttribute(_ key: String, value: Int) -> Span {
        lock.lock()
        defer { lock.unlock() }
        if hasEndedState == .notEnded {
            userDefinedAttrs[key] = value
        }
        return self
    }

    @discardableResult
    func setAttribute(_ key: String, value: Double) -> Span {
        lock.lock()
        defer { lock.unlock() }
        if hasEndedState == .notEnded {
            userDefinedAttrs[key] = value
        }
        return self
    }

    @discardableResult
    func setAttribute(_ key: String, value: Bool) -> Span {
        lock.lock()
        defer { lock.unlock() }
        if hasEndedState == .notEnded {
            userDefinedAttrs[key] = value
        }
        return self
    }

    @discardableResult
    func setAttributes(_ attributes: [String: Any]) -> Span {
        lock.lock()
        defer { lock.unlock() }
        if hasEndedState == .notEnded {
            for (key, value) in attributes {
                userDefinedAttrs[key] = value
            }
        }
        return self
    }

    @discardableResult
    func removeAttribute(_ key: String) -> Span {
        lock.lock()
        defer { lock.unlock() }
        if hasEndedState == .notEnded {
            userDefinedAttrs.removeValue(forKey: key)
        }
        return self
    }

    @discardableResult
    func end() -> Span {
        return end(timestamp: timeProvider.now())
    }

    @discardableResult
    func end(timestamp: Number) -> Span {
        lock.lock()
        defer { lock.unlock() }

        if hasEndedState != .notEnded {
            return self
        }

        hasEndedState = .ending
        endTime = timestamp
//        spanProcessor.onEnding(self)

        hasEndedState = .ended
//        spanProcessor.onEnded(self)
        printCheckpointBreakdown()
        return self
    }

    // TODO: this is only for debugging. remove this once SpanProcessor is implemented
    func printCheckpointBreakdown() {
        print("\n⏱  Span Checkpoint Breakdown for '\(name)':")

        var lastTimestamp = startTime

        // Include the start
        print("   • Start: \(startTime) ms")

        for checkpoint in checkpoints {
            let sinceStart = checkpoint.timestamp - startTime
            let sinceLast = checkpoint.timestamp - lastTimestamp
            print("   • \(checkpoint.name): \(checkpoint.timestamp) ms (+\(sinceStart) ms from start, +\(sinceLast) ms from previous checkpoint)")
            lastTimestamp = checkpoint.timestamp
        }

        // Include the end
        let sinceStart = endTime - startTime
        let sinceLast = endTime - lastTimestamp
        print("   • End: \(endTime) ms (+\(sinceStart) ms from start, +\(sinceLast) ms from last)")
        print("   → Total Duration: \(sinceStart) ms\n")
    }

    func hasEnded() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return hasEndedState == .ended
    }

    func getDuration() -> Number {
        lock.lock()
        defer { lock.unlock() }
        return calculateDuration()
    }

    func toSpanData() -> SpanData {
        lock.lock()
        defer { lock.unlock() }
        return SpanData(name: name,
                       traceId: traceId,
                       spanId: spanId,
                       parentId: parentId,
                       sessionId: sessionId,
                       startTime: startTime,
                       endTime: endTime,
                       duration: calculateDuration(),
                       status: status,
                       attributes: attributes,
                       userDefinedAttrs: userDefinedAttrs,
                       checkpoints: checkpoints,
                       hasEnded: hasEndedState == .ended,
                       isSampled: isSampled)
    }

    private func calculateDuration() -> Number {
        if hasEndedState == .ended {
            return endTime - startTime
        }
        return 0
    }
}
