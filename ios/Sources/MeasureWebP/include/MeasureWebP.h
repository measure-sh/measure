#ifndef MEASURE_WEBP_H
#define MEASURE_WEBP_H

#ifdef SWIFT_PACKAGE

#include "../libwebp/src/webp/encode.h"
#include "../libwebp/src/webp/types.h"
#else
// CocoaPods: this header is copied into the framework's Headers directory during
// the build, breaking relative paths to the submodule. Forward-declare the two
// functions that the Swift encoder uses directly to avoid the dependency.
#include <stddef.h>
#include <stdint.h>

extern size_t WebPEncodeRGBA(const uint8_t* rgba, int width, int height,
                             int stride, float quality_factor,
                             uint8_t** output);
extern void WebPFree(void* ptr);
#endif

#endif /* MEASURE_WEBP_H */
