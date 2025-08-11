#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MeasureModule, NSObject)

RCT_EXTERN_METHOD(initialize:(NSDictionary *)clientDict
                  configDict:(NSDictionary *)configDict
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(start)
RCT_EXTERN_METHOD(stop)

@end