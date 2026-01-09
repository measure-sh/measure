//
//  MeasureSDK.m
//  Measure
//
//  Created by Adwin Ross on 16/12/25.
//

#import "MeasureSDK.h"
#if __has_include(<Measure/Measure-Swift.h>)
#import <Measure/Measure-Swift.h>
#elif __has_include("Measure-Swift.h")
#import "Measure-Swift.h"
#else
#warning "Measure-Swift.h not found. Swift integration may not work."
#endif

@implementation MeasureSDK

+ (void)initializeWithApiKey:(NSString *)apiKey
                      apiUrl:(NSString *)apiUrl
                      config:(MSRConfig *)config
{
    ClientInfo *client = [[ClientInfo alloc] initWithApiKey:apiKey apiUrl:apiUrl];

    BaseMeasureConfig *swiftConfig = nil;
    if (config != nil) {
        swiftConfig = [[BaseMeasureConfig alloc] initWithEnableLogging:config.enableLogging
                                                             autoStart:config.autoStart
                                                requestHeadersProvider:config.requestHeadersProvider
                                                      maxDiskUsageInMb:config.maxDiskUsageInMb
                                              enableFullCollectionMode:config.enableFullCollectionMode];
    }

    [Measure initializeWith:client config:swiftConfig];
}

@end
