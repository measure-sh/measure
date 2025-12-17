//
//  MSRConfig.m
//  Measure
//
//  Created by Adwin Ross on 16/12/25.
//

#import "MSRConfig.h"

@implementation MSRConfig

- (instancetype)initWithEnableLogging:(BOOL)enableLogging
        samplingRateForErrorFreeSessions:(float)samplingRateForErrorFreeSessions
                     traceSamplingRate:(float)traceSamplingRate
              coldLaunchSamplingRate:(float)coldLaunchSamplingRate
              warmLaunchSamplingRate:(float)warmLaunchSamplingRate
                hotLaunchSamplingRate:(float)hotLaunchSamplingRate
                  journeySamplingRate:(float)journeySamplingRate
                    trackHttpHeaders:(BOOL)trackHttpHeaders
                       trackHttpBody:(BOOL)trackHttpBody
               httpHeadersBlocklist:(NSArray<NSString *> *)httpHeadersBlocklist
                    httpUrlBlocklist:(NSArray<NSString *> *)httpUrlBlocklist
                   httpUrlAllowlist:(NSArray<NSString *> *)httpUrlAllowlist
                           autoStart:(BOOL)autoStart
                screenshotMaskLevel:(ScreenshotMaskingLevel)screenshotMaskLevel
             requestHeadersProvider:(id<MsrRequestHeadersProvider>)requestHeadersProvider
                 maxDiskUsageInMb:(NSNumber *)maxDiskUsageInMb {

    self = [super init];
    if (self) {
        _enableLogging = enableLogging;
        _samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions;
        _traceSamplingRate = traceSamplingRate;
        _coldLaunchSamplingRate = coldLaunchSamplingRate;
        _warmLaunchSamplingRate = warmLaunchSamplingRate;
        _hotLaunchSamplingRate = hotLaunchSamplingRate;
        _journeySamplingRate = journeySamplingRate;
        _autoStart = autoStart;
        _trackHttpHeaders = trackHttpHeaders;
        _trackHttpBody = trackHttpBody;
        _httpHeadersBlocklist = [httpHeadersBlocklist copy];
        _httpUrlBlocklist = [httpUrlBlocklist copy];
        _httpUrlAllowlist = [httpUrlAllowlist copy];
        _screenshotMaskLevel = screenshotMaskLevel;
        _requestHeadersProvider = requestHeadersProvider;
        _maxDiskUsageInMb = maxDiskUsageInMb;
    }
    return self;
}

@end
