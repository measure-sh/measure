#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MeasureModule, NSObject)

RCT_EXTERN_METHOD(initialize:(NSDictionary *)clientDict
                  configDict:(NSDictionary *)configDict
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(start:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
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

@end