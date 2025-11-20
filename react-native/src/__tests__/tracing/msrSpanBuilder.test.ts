import { MsrSpan } from "../../tracing/msrSpan";
import { MsrSpanBuilder } from "../../tracing/msrSpanBuilder";

describe("MsrSpanBuilder", () => {
    let mockIdProvider: any;
    let mockTimeProvider: any;
    let mockSpanProcessor: any;
    let mockTraceSampler: any;
    let mockLogger: any;

    beforeEach(() => {
        mockIdProvider = { nextId: jest.fn(() => "span-id") };
        mockTimeProvider = { now: jest.fn(() => 1234567890) };
        mockSpanProcessor = { onStart: jest.fn(), onEnding: jest.fn(), onEnded: jest.fn() };
        mockTraceSampler = { shouldSample: jest.fn(() => true) };
        mockLogger = { log: jest.fn() };

        jest.spyOn(MsrSpan, "startSpan").mockReturnValue("mock-span" as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should initialize with provided dependencies", () => {
        const builder = new MsrSpanBuilder(
            "test-span",
            mockIdProvider,
            mockTimeProvider,
            mockSpanProcessor,
            mockTraceSampler,
            mockLogger
        );

        expect(builder.name).toBe("test-span");
        expect(builder.idProvider).toBe(mockIdProvider);
        expect(builder.timeProvider).toBe(mockTimeProvider);
        expect(builder.spanProcessor).toBe(mockSpanProcessor);
        expect(builder.traceSampler).toBe(mockTraceSampler);
        expect(builder.logger).toBe(mockLogger);
        expect(builder.parentSpan).toBeUndefined();
    });

    it("should chain setParent correctly", () => {
        const builder = new MsrSpanBuilder(
            "span",
            mockIdProvider,
            mockTimeProvider,
            mockSpanProcessor,
            mockTraceSampler,
            mockLogger
        );

        const parentSpan = { spanId: "parent-id" } as any;
        const returned = builder.setParent(parentSpan);

        expect(builder.parentSpan).toBe(parentSpan);
        expect(returned).toBe(builder);
    });

    it("should call MsrSpan.startSpan without timestamp when not provided", () => {
        const builder = new MsrSpanBuilder(
            "my-span",
            mockIdProvider,
            mockTimeProvider,
            mockSpanProcessor,
            mockTraceSampler,
            mockLogger
        );

        const result = builder.startSpan();

        expect(MsrSpan.startSpan).toHaveBeenCalledWith({
            name: "my-span",
            timeProvider: mockTimeProvider,
            idProvider: mockIdProvider,
            traceSampler: mockTraceSampler,
            parentSpan: undefined,
            spanProcessor: mockSpanProcessor,
            timestamp: undefined
        });
        expect(result).toBe("mock-span");
    });

    it("should call MsrSpan.startSpan with explicit timestamp", () => {
        const builder = new MsrSpanBuilder(
            "timed-span",
            mockIdProvider,
            mockTimeProvider,
            mockSpanProcessor,
            mockTraceSampler,
            mockLogger
        );

        const result = builder.startSpan(987654321);

        expect(MsrSpan.startSpan).toHaveBeenCalledWith({
            name: "timed-span",
            timeProvider: mockTimeProvider,
            idProvider: mockIdProvider,
            traceSampler: mockTraceSampler,
            parentSpan: undefined,
            spanProcessor: mockSpanProcessor,
            timestamp: 987654321
        });
        expect(result).toBe("mock-span");
    });

    it("should include parentSpan in MsrSpan.startSpan call when set", () => {
        const builder = new MsrSpanBuilder(
            "child-span",
            mockIdProvider,
            mockTimeProvider,
            mockSpanProcessor,
            mockTraceSampler,
            mockLogger
        );
        const parent = { id: "parent-span" } as any;

        builder.setParent(parent);
        builder.startSpan();

        expect(MsrSpan.startSpan).toHaveBeenCalledWith(
            expect.objectContaining({ parentSpan: parent })
        );
    });
});
