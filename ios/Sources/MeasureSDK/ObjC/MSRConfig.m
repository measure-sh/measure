//
//  MSRConfig.m
//  Measure
//
//  Created by Adwin Ross on 16/12/25.
//

#import "MSRConfig.h"

@implementation MSRConfig

- (instancetype)initWithEnableLogging:(BOOL)enableLogging
                            autoStart:(BOOL)autoStart
             enableFullCollectionMode:(BOOL)enableFullCollectionMode
               requestHeadersProvider:(id<MsrRequestHeadersProvider>)requestHeadersProvider
                     maxDiskUsageInMb:(NSNumber *)maxDiskUsageInMb {
    
    self = [super init];
    if (self) {
        _enableLogging = enableLogging;
        _autoStart = autoStart;
        _enableFullCollectionMode = enableFullCollectionMode;
        _requestHeadersProvider = requestHeadersProvider;
        _maxDiskUsageInMb = maxDiskUsageInMb;
    }
    return self;
}

@end
