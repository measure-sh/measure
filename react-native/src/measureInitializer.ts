import { Config } from './config/config';
import { ConfigLoader } from './config/configLoader';
import {
  ConfigProvider,
  type IConfigProvider,
} from './config/configProvider';
import { MeasureConfig } from './config/measureConfig';
import { MeasureLogger, type Logger } from './utils/logger';
import { MeasureTimeProvider, type TimeProvider } from './utils/timeProvider';
import {
  CustomEventCollector,
  type ICustomEventCollector,
} from './events/customEventCollector';
import {
  UserTriggeredEventCollector,
  type IUserTriggeredEventCollector,
} from './events/userTriggeredEventCollector';
import { SpanCollector, type ISpanCollector } from './tracing/spanCollector';
import type { Tracer } from './tracing/tracer';
import { TraceSampler, type ITraceSampler } from './tracing/traceSampler';
import { MsrTracer } from './tracing/msrTracer';
import { IdProvider, type IIdProvider } from './utils/idProvider';
import { Randomizer, type IRandomizer } from './utils/randomizer';
import { UuidGenerator, type IUuidGenerator } from './utils/uuidGenerator';
import { SpanProcessor, type ISpanProcessor } from './tracing/spanProcessor';
import {
  SignalProcessor,
  type ISignalProcessor,
} from './events/signalProcessor';
import {
  NativeApiProcessor,
  type INativeApiProcessor,
} from './events/nativeApiProcessor';
import {
  BugReportCollector,
  type IBugReportCollector,
} from './bugReport/bugReportCollector';
import { ScreenshotCollector, type IScreenshotCollector } from './screenshot/screenshotCollector';
import { LayoutSnapshotCollector, type ILayoutSnapshotCollector } from './layoutSnapshot/layoutSnapshotCollector';

export interface IMeasureInitializer {
  logger: Logger;
  configProvider: IConfigProvider;
  configLoader: ConfigLoader;
  config: Config;
  timeProvider: TimeProvider;
  customEventCollector: ICustomEventCollector;
  userTriggeredEventCollector: IUserTriggeredEventCollector;
  spanCollector: ISpanCollector;
  tracer: Tracer;
  idProvider: IIdProvider;
  randormizer: IRandomizer;
  uuidGenerator: IUuidGenerator;
  spanProcessor: ISpanProcessor;
  signalProcessor: ISignalProcessor;
  traceSampler: ITraceSampler;
  nativeApiProcessor: INativeApiProcessor;
  bugReportCollector: IBugReportCollector;
  screenshotCollector: IScreenshotCollector;
  layoutSnapshotCollector: ILayoutSnapshotCollector;
}

export class MeasureInitializer implements IMeasureInitializer {
  logger: Logger;
  configProvider: IConfigProvider;
  configLoader: ConfigLoader;
  config: Config;
  timeProvider: TimeProvider;
  customEventCollector: ICustomEventCollector;
  userTriggeredEventCollector: IUserTriggeredEventCollector;
  spanCollector: ISpanCollector;
  tracer: Tracer;
  idProvider: IIdProvider;
  randormizer: IRandomizer;
  uuidGenerator: IUuidGenerator;
  spanProcessor: ISpanProcessor;
  signalProcessor: ISignalProcessor;
  traceSampler: ITraceSampler;
  nativeApiProcessor: INativeApiProcessor;
  bugReportCollector: IBugReportCollector;
  screenshotCollector: IScreenshotCollector;
  layoutSnapshotCollector: ILayoutSnapshotCollector;

  constructor(config: MeasureConfig | null) {
    this.logger = new MeasureLogger(
      'Measure',
      config?.enableLogging ?? true,
      true
    );
    this.config = new Config(
      config?.enableLogging,
      config?.autoStart,
      config?.enableFullCollectionMode
    );
    this.configLoader = new ConfigLoader(this.logger);
    this.configProvider = new ConfigProvider(this.config);
    this.timeProvider = new MeasureTimeProvider();
    this.signalProcessor = new SignalProcessor(this.logger);
    this.customEventCollector = new CustomEventCollector({
      logger: this.logger,
      timeProvider: this.timeProvider,
      configProvider: this.configProvider,
      signalProcessor: this.signalProcessor,
    });
    this.userTriggeredEventCollector = new UserTriggeredEventCollector({
      logger: this.logger,
      timeProvider: this.timeProvider,
      signalProcessor: this.signalProcessor,
    });
    this.uuidGenerator = new UuidGenerator();
    this.randormizer = new Randomizer();
    this.idProvider = new IdProvider(this.randormizer, this.uuidGenerator);
    this.traceSampler = new TraceSampler(this.configProvider);
    this.spanProcessor = new SpanProcessor(
      this.logger,
      this.signalProcessor,
      this.configProvider,
      this.traceSampler
    );
    this.tracer = new MsrTracer(
      this.logger,
      this.idProvider,
      this.timeProvider,
      this.spanProcessor,
      this.traceSampler
    );
    this.spanCollector = new SpanCollector(this.tracer);
    this.nativeApiProcessor = new NativeApiProcessor({
      logger: this.logger,
    });
    this.bugReportCollector = new BugReportCollector({ logger: this.logger });
    this.screenshotCollector = new ScreenshotCollector();
    this.layoutSnapshotCollector = new LayoutSnapshotCollector();
  }
}
