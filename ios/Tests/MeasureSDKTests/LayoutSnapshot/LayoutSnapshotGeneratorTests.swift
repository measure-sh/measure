//
//  LayoutSnapshotGeneratorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 18/03/26.
//

import XCTest
@testable import Measure

final class BaseLayoutSnapshotGeneratorTests: XCTestCase {
    private var sut: BaseLayoutSnapshotGenerator!
    private var mockLogger: MockLogger!
    private var mockConfigProvider: MockConfigProvider!
    private var mockTimeProvider: MockTimeProvider!
    private var mockAttachmentProcessor: MockAttachmentProcessor!
    private var mockSvgGenerator: MockSvgGenerator!
    private var mockDispatchQueue: MockMeasureDispatchQueue!

    override func setUp() {
        super.setUp()
        mockLogger = MockLogger()
        mockConfigProvider = MockConfigProvider()
        mockTimeProvider = MockTimeProvider()
        mockAttachmentProcessor = MockAttachmentProcessor()
        mockSvgGenerator = MockSvgGenerator()
        mockDispatchQueue = MockMeasureDispatchQueue()

        sut = BaseLayoutSnapshotGenerator(
            logger: mockLogger,
            configProvider: mockConfigProvider,
            timeProvider: mockTimeProvider,
            attachmentProcessor: mockAttachmentProcessor,
            svgGenerator: mockSvgGenerator,
            measureDispatchQueue: mockDispatchQueue
        )
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    func test_generateSvg_debounce_returnsNilWhenCalledWithinDebounceInterval() {
        mockConfigProvider = MockConfigProvider(layoutSnapshotDebounceInterval: 750)
        mockTimeProvider.current = 1000
        mockSvgGenerator.generatedData = Data()
        mockAttachmentProcessor.attachment = makeMockAttachment()
        recreateSut()

        var firstResult: MsrAttachment?
        var secondResult: MsrAttachment? = makeMockAttachment()

        sut.generate(window: makeWindow(), touchPoint: .zero) { firstResult = $0 }

        mockTimeProvider.current = 1500
        sut.generate(window: makeWindow(), touchPoint: .zero) { secondResult = $0 }

        XCTAssertNotNil(firstResult)
        XCTAssertNil(secondResult)
    }

    func test_generateSvg_debounce_succeedsAfterDebounceIntervalPasses() {
        mockConfigProvider = MockConfigProvider(layoutSnapshotDebounceInterval: 750)
        mockTimeProvider.current = 1000
        mockSvgGenerator.generatedData = Data()
        mockAttachmentProcessor.attachment = makeMockAttachment()
        recreateSut()

        var firstResult: MsrAttachment?
        var secondResult: MsrAttachment?

        sut.generate(window: makeWindow(), touchPoint: .zero) { firstResult = $0 }

        mockTimeProvider.current = 2000
        sut.generate(window: makeWindow(), touchPoint: .zero) { secondResult = $0 }

        XCTAssertNotNil(firstResult)
        XCTAssertNotNil(secondResult)
    }

    func test_generateSvg_returnsNilWhenSvgGeneratorReturnsNil() {
        mockSvgGenerator.generatedData = nil
        var result: MsrAttachment? = makeMockAttachment()

        sut.generate(window: makeWindow(), touchPoint: .zero) { result = $0 }

        XCTAssertNil(result)
    }

    func test_generateSvg_returnsAttachmentOnSuccess() {
        let expected = makeMockAttachment()
        mockSvgGenerator.generatedData = Data()
        mockAttachmentProcessor.attachment = expected
        mockTimeProvider.current = 1000

        var result: MsrAttachment?
        sut.generate(window: makeWindow(), touchPoint: .zero) { result = $0 }

        XCTAssertEqual(result?.id, expected.id)
    }

    func test_generateSvg_marksHitTestedViewAsTarget() {
        let window = makeWindow() // single instance
        let targetView = UIView(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        window.addSubview(targetView)
        mockSvgGenerator.generatedData = Data()
        mockAttachmentProcessor.attachment = makeMockAttachment()
        mockTimeProvider.current = 1000

        sut.generate(window: window, touchPoint: CGPoint(x: 50, y: 50)) { _ in }

        let frames = mockSvgGenerator.frames ?? []
        let targetFrames = frames.filter { $0.isTarget }
        XCTAssertEqual(targetFrames.count, 1)
    }

    func test_generateForViewController_returnsNilWhenViewIsNil() {
        let vc = ViewControllerWithNilView()
        var result: MsrAttachment? = makeMockAttachment()

        sut.generate(for: vc) { result = $0 }

        XCTAssertNil(result)
    }

    func test_generateForViewController_noViewIsHighlighted() {
        let vc = UIViewController()
        vc.loadViewIfNeeded()
        let subview = UIView(frame: CGRect(x: 0, y: 0, width: 50, height: 50))
        vc.view.addSubview(subview)
        mockSvgGenerator.generatedData = Data()
        mockAttachmentProcessor.attachment = makeMockAttachment()

        sut.generate(for: vc) { _ in }

        let frames = mockSvgGenerator.frames ?? []
        XCTAssertTrue(frames.allSatisfy { !$0.isTarget })
    }

    func test_generateForViewController_returnsAttachmentOnSuccess() {
        let vc = UIViewController()
        vc.loadViewIfNeeded()
        let expected = makeMockAttachment()
        mockSvgGenerator.generatedData = Data()
        mockAttachmentProcessor.attachment = expected

        var result: MsrAttachment?
        sut.generate(for: vc) { result = $0 }

        XCTAssertEqual(result?.id, expected.id)
    }

    func test_generateJson_returnsAttachmentWithCorrectType() {
        let expected = makeMockAttachment(type: .layoutSnapshotJson)
        mockAttachmentProcessor.attachment = expected

        var result: MsrAttachment?
        sut.generate(for: makeWindow(), touchPoint: .zero) { result = $0 }

        XCTAssertEqual(result?.id, expected.id)
    }

    func test_generateJson_usesGzipFileStorageType() {
        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)

        sut.generate(for: makeWindow(), touchPoint: .zero) { _ in }

        XCTAssertEqual(mockProcessor.capturedStorageType, .gzipFileStorage)
    }

    func test_generateJson_usesLayoutSnapshotJsonAttachmentType() {
        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)

        sut.generate(for: makeWindow(), touchPoint: .zero) { _ in }

        XCTAssertEqual(mockProcessor.capturedAttachmentType, .layoutSnapshotJson)
    }

    func test_generateJson_encodedDataIsValidJsonString() {
        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)

        sut.generate(for: makeWindow(), touchPoint: .zero) { _ in }

        let data = mockProcessor.capturedData
        XCTAssertNotNil(data)
        if let data {
            let jsonString = String(data: data, encoding: .utf8)
            XCTAssertNotNil(jsonString)
            XCTAssertTrue(jsonString?.hasPrefix("{") == true)
        }
    }

    func test_ignoredViewClassNames_floatingBarHostingViewIsExcluded() {
        let window = makeWindow()
        let ignored = FloatingBarHostingViewStub(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        window.addSubview(ignored)

        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)

        sut.generate(for: window, touchPoint: .zero) { _ in }

        let node = mockProcessor.capturedNode
        XCTAssertFalse(containsViewClass("FloatingBarHostingView", in: node))
    }

    func test_ignoredViewClassNames_floatingBarContainerViewIsExcluded() {
        let window = makeWindow()
        let ignored = FloatingBarContainerViewStub(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        window.addSubview(ignored)

        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)

        sut.generate(for: window, touchPoint: .zero) { _ in }

        let node = mockProcessor.capturedNode
        XCTAssertFalse(containsViewClass("FloatingBarContainerView", in: node))
    }

    func test_ignoredView_childrenAreAlsoExcluded() {
        let window = makeWindow()
        let ignored = FloatingBarHostingViewStub(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        let child = UILabel(frame: CGRect(x: 0, y: 0, width: 50, height: 20))
        child.text = "should be excluded"
        child.accessibilityLabel = "should be excluded"
        ignored.addSubview(child)
        window.addSubview(ignored)

        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)

        sut.generate(for: window, touchPoint: .zero) { _ in }

        let node = mockProcessor.capturedNode
        XCTAssertFalse(containsLabel("should be excluded", in: node))
    }

    func test_buildSnapshotNode_onlyHitTestedViewIsHighlighted() {
        let window = makeWindow()
        let targetView = UIView(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        window.addSubview(targetView)

        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)

        sut.generate(for: window, touchPoint: CGPoint(x: 50, y: 50)) { _ in }

        guard let node = mockProcessor.capturedNode else {
            return XCTFail("No node captured")
        }
        let highlighted = allNodes(in: node).filter { $0.highlighted }
        XCTAssertEqual(highlighted.count, 1)
    }

    func test_scrollableTypes() {
        let layout = UICollectionViewFlowLayout()

        assertScrollable(UIScrollView(frame: .zero))
        assertScrollable(UIDatePicker(frame: .zero))
        assertScrollable(UIPickerView(frame: .zero))
        assertScrollable(UITableView(frame: .zero))
        assertScrollable(UICollectionView(frame: .zero, collectionViewLayout: layout))

        assertNotScrollable(UIView(frame: .zero))
        assertNotScrollable(UILabel(frame: .zero))
    }

    func test_resolveElementType() {
        class CustomButton: UIButton {}
        let layout = UICollectionViewFlowLayout()

        assertElementType(UIButton(frame: .zero), expected: .button)
        assertElementType(CustomButton(frame: .zero), expected: .button)
        assertElementType(UILabel(frame: .zero), expected: .text)
        assertElementType(UITextField(frame: .zero), expected: .input)
        assertElementType(UITextView(frame: .zero), expected: .input)
        assertElementType(UIImageView(frame: .zero), expected: .image)
        assertElementType(UISlider(frame: .zero), expected: .slider)
        assertElementType(UIProgressView(frame: .zero), expected: .progress)
        assertElementType(UISwitch(frame: .zero), expected: .checkbox)
        assertElementType(UITableView(frame: .zero), expected: .list)
        assertElementType(UICollectionView(frame: .zero, collectionViewLayout: layout), expected: .list)
        assertElementType(UIPickerView(frame: .zero), expected: .dropdown)
        assertElementType(UISegmentedControl(frame: .zero), expected: .dropdown)
        assertElementType(UIScrollView(frame: .zero), expected: .container)
        assertElementType(UIView(frame: .zero), expected: .container)
    }

    func test_resolveLabel_prefersAccessibilityLabel() {
        let view = UIView(frame: .zero)
        view.accessibilityLabel = "accessibilityLabel"
        assertLabel(view, expected: "accessibilityLabel")
    }

    func test_resolveLabel_fallsBackToClassNameWhenAccessibilityLabelIsNil() {
        let view = UIView(frame: .zero)
        view.accessibilityLabel = nil
        assertLabel(view, expected: "UIView")
    }

    func test_resolveLabel_fallsBackToClassNameWhenAccessibilityLabelIsEmpty() {
        let view = UIView(frame: .zero)
        view.accessibilityLabel = ""
        assertLabel(view, expected: "UIView")
    }
}

private extension BaseLayoutSnapshotGeneratorTests {
    func makeWindow() -> UIWindow {
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.makeKeyAndVisible()
        return window
    }

    func makeMockAttachment(type: AttachmentType = .layoutSnapshot) -> MsrAttachment {
        MsrAttachment(name: "test", type: type, size: 0, id: UUID().uuidString, bytes: nil, path: "/path")
    }

    func recreateSut(attachmentProcessor: AttachmentProcessor? = nil) {
        sut = BaseLayoutSnapshotGenerator(logger: mockLogger,
                                          configProvider: mockConfigProvider,
                                          timeProvider: mockTimeProvider,
                                          attachmentProcessor: attachmentProcessor ?? mockAttachmentProcessor,
                                          svgGenerator: mockSvgGenerator,
                                          measureDispatchQueue: mockDispatchQueue)
    }

    func assertScrollable(_ view: UIView, file: StaticString = #file, line: UInt = #line) {
        let window = makeWindow()
        view.frame = CGRect(x: 0, y: 0, width: 100, height: 100)
        window.addSubview(view)

        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)
        sut.generate(for: window, touchPoint: .zero) { _ in }

        let nodes = allNodes(in: mockProcessor.capturedNode)
        XCTAssertTrue(nodes.contains { $0.scrollable }, file: file, line: line)
    }

    func assertNotScrollable(_ view: UIView, file: StaticString = #file, line: UInt = #line) {
        let window = makeWindow()
        view.frame = CGRect(x: 0, y: 0, width: 100, height: 100)
        window.addSubview(view)

        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)
        sut.generate(for: window, touchPoint: .zero) { _ in }

        let nodes = allNodes(in: mockProcessor.capturedNode).filter { $0.scrollable }
        XCTAssertTrue(nodes.isEmpty, file: file, line: line)
    }

    func assertElementType(_ view: UIView, expected: ElementType, file: StaticString = #file, line: UInt = #line) {
        let window = makeWindow()
        view.frame = CGRect(x: 0, y: 0, width: 100, height: 100)
        window.addSubview(view)

        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)
        sut.generate(for: window, touchPoint: .zero) { _ in }

        let nodes = allNodes(in: mockProcessor.capturedNode)
        XCTAssertTrue(nodes.contains { $0.type == expected }, file: file, line: line)
    }

    func assertLabel(_ view: UIView, expected: String, file: StaticString = #file, line: UInt = #line) {
        let window = makeWindow()
        view.frame = CGRect(x: 0, y: 0, width: 100, height: 100)
        window.addSubview(view)

        let mockProcessor = MockAttachmentProcessor()
        recreateSut(attachmentProcessor: mockProcessor)
        sut.generate(for: window, touchPoint: .zero) { _ in }

        let nodes = allNodes(in: mockProcessor.capturedNode)
        XCTAssertTrue(nodes.contains { $0.label == expected }, file: file, line: line)
    }

    func allNodes(in node: SnapshotNode?) -> [SnapshotNode] {
        guard let node else { return [] }
        return [node] + node.children.flatMap { allNodes(in: $0) }
    }

    func containsViewClass(_ className: String, in node: SnapshotNode?) -> Bool {
        allNodes(in: node).contains { $0.label.contains(className) }
    }

    func containsLabel(_ label: String, in node: SnapshotNode?) -> Bool {
        allNodes(in: node).contains { $0.label == label }
    }
}

/// Stub to simulate FloatingBarHostingView without importing private API
private class FloatingBarHostingViewStub: UIView {}
private class FloatingBarContainerViewStub: UIView {}

/// Simulates a UIViewController whose view property returns nil
private class ViewControllerWithNilView: UIViewController {
    override var view: UIView! {
        get { return nil }
        set {}
    }
}
