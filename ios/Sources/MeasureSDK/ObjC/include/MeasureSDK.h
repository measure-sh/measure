//
//  MeasureSDK.h
//  Measure
//
//  Created by Adwin Ross on 16/12/25.
//

#import <Foundation/Foundation.h>
#if __has_include(<Measure/MSRConfig.h>)
#import <Measure/MSRConfig.h>
#elif __has_include("MSRConfig.h")
#import "MSRConfig.h"
#else
#warning "MSRConfig.h not found. Swift integration may not work."
#endif

NS_ASSUME_NONNULL_BEGIN

@interface MeasureSDK : NSObject

+ (void)initializeWithApiKey:(NSString *)apiKey
                      apiUrl:(NSString *)apiUrl
                      config:(nullable MSRConfig *)config;

@end

NS_ASSUME_NONNULL_END
