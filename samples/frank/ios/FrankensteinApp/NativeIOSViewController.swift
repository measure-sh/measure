import SwiftUI
import UIKit
import Measure

// MARK: - Theme (matches HomeViewController MeasureColors)

private struct NativeScreenColors {
    let background: Color
    let surface: Color
    let onSurface: Color
    let onSurfaceVariant: Color

    static let light = NativeScreenColors(
        background: Color(red: 0xFA / 255.0, green: 0xFA / 255.0, blue: 0xFA / 255.0),
        surface: Color.white,
        onSurface: Color(red: 0x1C / 255.0, green: 0x1B / 255.0, blue: 0x1F / 255.0),
        onSurfaceVariant: Color(red: 0x49 / 255.0, green: 0x45 / 255.0, blue: 0x4F / 255.0)
    )

    static let dark = NativeScreenColors(
        background: Color(red: 0x12 / 255.0, green: 0x12 / 255.0, blue: 0x12 / 255.0),
        surface: Color(red: 0x1E / 255.0, green: 0x1E / 255.0, blue: 0x1E / 255.0),
        onSurface: Color(red: 0xE6 / 255.0, green: 0xE1 / 255.0, blue: 0xE5 / 255.0),
        onSurfaceVariant: Color(red: 0xCA / 255.0, green: 0xC4 / 255.0, blue: 0xD0 / 255.0)
    )
}

// MARK: - ViewController holder

private final class ViewControllerHolder: ObservableObject {
    weak var viewController: UIViewController?
}

// MARK: - Demo model

private enum DemoCategory: String, CaseIterable {
    case crashes = "Crashes"
    case bugReports = "Bug Reports"
    case http = "HTTP"
    case misc = "Misc"
}

private enum DemoAction: String {
    // Crashes
    case abort, badPointer, corruptMemory, corruptObject, deadlock
    case nsException, stackOverflow, zombie, zombieNSException
    case backgroundCrash, segfault, sigabrt, sigill, sigbus
    // Bug Reports
    case launchBugReport, trackBugReport, shakeToReport
    // HTTP
    case httpGet200, httpPost201, httpPut400, httpGetError, httpGetNonJson
    // Misc
    case customEvent, trackError, createSpan, setUserId, clearUserId
}

private struct DemoItem: Identifiable {
    let id: String
    let title: String
    let description: String
    let category: DemoCategory
    let action: DemoAction
    var isToggle: Bool { action == .shakeToReport }
}

private let demos: [DemoItem] = [
    // Crashes
    DemoItem(id: "abort", title: "Abort", description: "Calls abort()", category: .crashes, action: .abort),
    DemoItem(id: "bad-pointer", title: "Bad Pointer", description: "Writes to 0xDEADBEEF", category: .crashes, action: .badPointer),
    DemoItem(id: "corrupt-memory", title: "Corrupt Memory", description: "Array out-of-bounds access", category: .crashes, action: .corruptMemory),
    DemoItem(id: "corrupt-object", title: "Corrupt Object", description: "Invalid selector on NSArray", category: .crashes, action: .corruptObject),
    DemoItem(id: "deadlock", title: "Deadlock", description: "Recursive sync dispatch on same queue", category: .crashes, action: .deadlock),
    DemoItem(id: "ns-exception", title: "NSException", description: "Uncaught Objective-C exception", category: .crashes, action: .nsException),
    DemoItem(id: "stack-overflow", title: "Stack Overflow", description: "Infinite recursion", category: .crashes, action: .stackOverflow),
    DemoItem(id: "zombie", title: "Zombie", description: "Access deallocated object", category: .crashes, action: .zombie),
    DemoItem(id: "zombie-ns", title: "Zombie NSException", description: "Raise deallocated exception", category: .crashes, action: .zombieNSException),
    DemoItem(id: "bg-crash", title: "Background Thread Crash", description: "Exception on background queue", category: .crashes, action: .backgroundCrash),
    DemoItem(id: "segfault", title: "Segmentation Fault", description: "SIGSEGV — use-after-free", category: .crashes, action: .segfault),
    DemoItem(id: "sigabrt", title: "Abnormal Termination", description: "SIGABRT — assertion failure", category: .crashes, action: .sigabrt),
    DemoItem(id: "sigill", title: "Illegal Instruction", description: "SIGILL — null instruction pointer", category: .crashes, action: .sigill),
    DemoItem(id: "sigbus", title: "Bus Error", description: "SIGBUS — unaligned memory access", category: .crashes, action: .sigbus),
    // Bug Reports
    DemoItem(id: "launch-bug-report", title: "Launch Bug Report", description: "Opens interactive bug report UI", category: .bugReports, action: .launchBugReport),
    DemoItem(id: "track-bug-report", title: "Track Bug Report", description: "Captures screenshot and submits report", category: .bugReports, action: .trackBugReport),
    DemoItem(id: "shake-to-report", title: "Shake to Report", description: "Shake device to open bug report", category: .bugReports, action: .shakeToReport),
    // HTTP
    DemoItem(id: "http-get-200", title: "GET — 200 OK", description: "Successful JSON response", category: .http, action: .httpGet200),
    DemoItem(id: "http-post-201", title: "POST — 201 Created", description: "JSON request and response body", category: .http, action: .httpPost201),
    DemoItem(id: "http-put-400", title: "PUT — 400 Client Error", description: "Client error response", category: .http, action: .httpPut400),
    DemoItem(id: "http-get-error", title: "GET — Network Error", description: "Request timeout error", category: .http, action: .httpGetError),
    DemoItem(id: "http-get-nonjson", title: "GET — Non-JSON Response", description: "HTML content type response", category: .http, action: .httpGetNonJson),
    // Misc
    DemoItem(id: "custom-event", title: "Custom Event", description: "Tracks an event with attributes", category: .misc, action: .customEvent),
    DemoItem(id: "track-error", title: "Track Error", description: "Tracks a file-not-found error", category: .misc, action: .trackError),
    DemoItem(id: "create-span", title: "Create Span", description: "Span with checkpoints and attributes", category: .misc, action: .createSpan),
    DemoItem(id: "set-user", title: "Set User ID", description: "Sets a dummy user ID on the SDK", category: .misc, action: .setUserId),
    DemoItem(id: "clear-user", title: "Clear User ID", description: "Clears the current user ID", category: .misc, action: .clearUserId),
]

// MARK: - Crash triggers

private func triggerCrash(_ action: DemoAction) {
    switch action {
    case .abort:
        Darwin.abort()
    case .badPointer:
        let pointer = UnsafeMutableRawPointer(bitPattern: 0xdeadbeef)!
        pointer.storeBytes(of: 0, as: Int.self)
    case .corruptMemory:
        let array = [1, 2, 3]
        _ = array[10]
    case .corruptObject:
        let object: AnyObject = NSArray()
        _ = object.perform(Selector(("invalidSelector")))
    case .deadlock:
        let queue = DispatchQueue(label: "deadlockQueue")
        queue.sync { queue.sync {} }
    case .nsException:
        let array = NSArray()
        print(array[1])
    case .stackOverflow:
        func recurse() { recurse() }
        recurse()
    case .zombie:
        var object: NSObject? = NSObject()
        let weakObject = object
        object = nil
        print(weakObject!.description)
    case .zombieNSException:
        var exception: NSException? = NSException(name: .genericException, reason: "Test", userInfo: nil)
        let weakException = exception
        exception = nil
        weakException?.raise()
    case .backgroundCrash:
        DispatchQueue(label: "com.frank.backgroundCrash", qos: .background).async {
            let array = NSArray()
            print(array[1])
        }
    case .segfault:
        let pointer = UnsafeMutablePointer<Int>.allocate(capacity: 1)
        pointer.deallocate()
        pointer.pointee = 42
    case .sigabrt:
        let array: [Int] = []
        print(array[1])
    case .sigill:
        let ptr: UnsafeMutablePointer<Void> = UnsafeMutablePointer(bitPattern: 0)!
        print(ptr.pointee)
    case .sigbus:
        let addr = UnsafeMutableRawPointer(bitPattern: 0x1)
        addr!.storeBytes(of: 0, as: Int.self)
    default:
        break
    }
}

// MARK: - SwiftUI View

private struct NativeIOSScreen: View {
    @Environment(\.colorScheme) private var colorScheme
    @ObservedObject var holder: ViewControllerHolder
    @State private var shakeEnabled = false

    private var colors: NativeScreenColors {
        colorScheme == .dark ? .dark : .light
    }

    private var grouped: [(DemoCategory, [DemoItem])] {
        DemoCategory.allCases.compactMap { cat in
            let items = demos.filter { $0.category == cat }
            return items.isEmpty ? nil : (cat, items)
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ForEach(grouped, id: \.0) { category, items in
                    sectionHeader(category.rawValue)
                    ForEach(items) { item in
                        if item.isToggle {
                            toggleCard(item)
                        } else {
                            demoCard(item)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(colors.background.ignoresSafeArea())
.onDisappear {
            if shakeEnabled {
                Measure.onShake(nil)
                shakeEnabled = false
            }
        }
    }

    // MARK: Subviews

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(colors.onSurfaceVariant)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 8)
    }

    private func demoCard(_ item: DemoItem) -> some View {
        Button {
            handleAction(item.action)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(colors.onSurface)
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(colors.onSurfaceVariant)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(colors.surface.opacity(0.6))
            )
        }
    }

    private func toggleCard(_ item: DemoItem) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(colors.onSurface)
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(colors.onSurfaceVariant)
            }
            Spacer()
            Toggle("", isOn: $shakeEnabled)
                .labelsHidden()
                .onChange(of: shakeEnabled) { enabled in
                    if enabled {
                        Measure.onShake {
                            Measure.launchBugReport(takeScreenshot: true)
                        }
                    } else {
                        Measure.onShake(nil)
                    }
                }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(colors.surface.opacity(0.6))
        )
    }

    // MARK: Actions

    private func handleAction(_ action: DemoAction) {
        switch action {
        // Crashes
        case .abort, .badPointer, .corruptMemory, .corruptObject, .deadlock,
             .nsException, .stackOverflow, .zombie, .zombieNSException,
             .backgroundCrash, .segfault, .sigabrt, .sigill, .sigbus:
            triggerCrash(action)

        // Bug Reports
        case .launchBugReport:
            Measure.launchBugReport(takeScreenshot: true)
        case .trackBugReport:
            guard let vc = holder.viewController else { return }
            Measure.captureScreenshot(for: vc) { screenshot in
                Measure.captureLayoutSnapshot(for: vc) { layout in
                    var attachments: [MsrAttachment] = []
                    if let s = screenshot { attachments.append(s) }
                    if let l = layout { attachments.append(l) }
                    Measure.trackBugReport(
                        description: "Bug report from native iOS demos",
                        attachments: attachments
                    )
                }
            }
        case .shakeToReport:
            break // handled by toggle

        // HTTP
        case .httpGet200:
            let startTime = UInt64(CFAbsoluteTimeGetCurrent() * 1000)
            Measure.trackHttpEvent(
                url: "https://api.example.com/users",
                method: "get",
                startTime: startTime,
                endTime: startTime + 150,
                client: "URLSession",
                statusCode: 200,
                responseHeaders: ["Content-Type": "application/json"],
                responseBody: #"{"id":1,"name":"Alice"}"#
            )
        case .httpPost201:
            let startTime = UInt64(CFAbsoluteTimeGetCurrent() * 1000)
            Measure.trackHttpEvent(
                url: "https://api.example.com/users",
                method: "post",
                startTime: startTime,
                endTime: startTime + 150,
                client: "URLSession",
                statusCode: 201,
                requestHeaders: ["Content-Type": "application/json"],
                responseHeaders: ["Content-Type": "application/json"],
                requestBody: #"{"name":"Alice"}"#,
                responseBody: #"{"id":42}"#
            )
        case .httpPut400:
            let startTime = UInt64(CFAbsoluteTimeGetCurrent() * 1000)
            Measure.trackHttpEvent(
                url: "https://api.example.com/users/42",
                method: "put",
                startTime: startTime,
                endTime: startTime + 150,
                client: "URLSession",
                statusCode: 400,
                responseHeaders: ["Content-Type": "application/json"],
                responseBody: #"{"error":"Invalid request"}"#
            )
        case .httpGetError:
            let startTime = UInt64(CFAbsoluteTimeGetCurrent() * 1000)
            Measure.trackHttpEvent(
                url: "https://api.example.com/timeout",
                method: "get",
                startTime: startTime,
                endTime: startTime + 150,
                client: "URLSession",
                error: URLError(.timedOut)
            )
        case .httpGetNonJson:
            let startTime = UInt64(CFAbsoluteTimeGetCurrent() * 1000)
            Measure.trackHttpEvent(
                url: "https://example.com/html",
                method: "get",
                startTime: startTime,
                endTime: startTime + 150,
                client: "URLSession",
                statusCode: 200,
                responseHeaders: ["Content-Type": "text/html"],
                responseBody: "<html>ignored</html>"
            )

        // Misc
        case .customEvent:
            let attributes: [String: AttributeValue] = [
                "screen": .string("NativeIOS"),
                "action": .string("Track Custom Event"),
            ]
            Measure.trackEvent(name: "button_click", attributes: attributes, timestamp: nil)
        case .trackError:
            do {
                _ = try String(contentsOfFile: "/nonexistent/path.txt", encoding: .utf8)
            } catch {
                Measure.trackError(error, collectStackTraces: true)
            }
        case .createSpan:
            let span = Measure.startSpan(name: "load-data")
            span.setCheckpoint("on-start")
            span.setAttribute("platform", value: "ios-native")
            span.setAttribute("is_premium", value: false)
            span.setStatus(.error)
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                span.setCheckpoint("on-complete")
                span.setStatus(.ok)
                span.end()
            }
        case .setUserId:
            Measure.setUserId("user-131351")
        case .clearUserId:
            Measure.clearUserId()
        }
    }
}

// MARK: - UIKit wrapper

class NativeIOSViewController: UIHostingController<AnyView> {
    private let holder: ViewControllerHolder

    init() {
        let holder = ViewControllerHolder()
        self.holder = holder
        super.init(rootView: AnyView(NativeIOSScreen(holder: holder)))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        holder.viewController = self
    }
}
