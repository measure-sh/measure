#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MeasureModule, NSObject)

RCT_EXTERN_METHOD(initialize:(NSString *)apiKey
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end