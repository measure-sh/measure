#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(MeasureModule, NSObject)

RCT_EXTERN_METHOD(trackEvent:(NSDictionary *)data
                  type:(NSString *)type
                  timestamp:(nonnull NSNumber *)timestamp
                  attributes:(NSDictionary *)attributes
                  userDefinedAttrs:(NSDictionary *)userDefinedAttrs
                  userTriggered:(BOOL)userTriggered
                  sessionId:(NSString * _Nullable)sessionId
                  threadName:(NSString * _Nullable)threadName
                  attachments:(NSArray *)attachments
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(trackSpan:(NSString *)name
                  traceId:(NSString *)traceId
                  spanId:(NSString *)spanId
                  parentId:(NSString * _Nullable)parentId
                  startTime:(nonnull NSNumber *)startTime
                  endTime:(nonnull NSNumber *)endTime
                  duration:(nonnull NSNumber *)duration
                  status:(nonnull NSNumber *)status
                  attributes:(NSDictionary *)attributes
                  userDefinedAttrs:(NSDictionary *)userDefinedAttrs
                  checkpoints:(NSDictionary *)checkpoints
                  hasEnded:(BOOL)hasEnded
                  isSampled:(BOOL)isSampled
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setUserId:(NSString *)userId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearUserId:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(trackHttpEvent:
                  (NSString *)url
                  method:(NSString *)method
                  startTime:(nonnull NSNumber *)startTime
                  endTime:(nonnull NSNumber *)endTime
                  statusCode:(nullable NSNumber *)statusCode
                  error:(nullable NSString *)error
                  requestHeaders:(nullable NSDictionary *)requestHeaders
                  responseHeaders:(nullable NSDictionary *)responseHeaders
                  requestBody:(nullable NSString *)requestBody
                  responseBody:(nullable NSString *)responseBody
                  client:(NSString *)client
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(launchBugReport:(BOOL)takeScreenshot
                  bugReportConfig:(NSDictionary *)bugReportConfig
                  attributes:(NSDictionary *)attributes
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setShakeListener:(BOOL)enable)
RCT_EXTERN_METHOD(captureScreenshot:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(captureLayoutSnapshot:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(trackBugReport:(NSString *)description
                  attachments:(NSArray *)attachments
                  attributes:(NSDictionary *)attributes
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getSessionId:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getDynamicConfig:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
