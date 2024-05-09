#include <jni.h>

#include "anr_handler.h"

#ifdef __cplusplus
extern "C" {
#endif

JNIEXPORT jboolean JNICALL
Java_sh_measure_NativeBridgeImpl_enableAnrReportingInternal(JNIEnv *env, jobject bridge) {
    return msr_enable_anr_handler(env, bridge);
}

JNIEXPORT void JNICALL
Java_sh_measure_NativeBridgeImpl_disableAnrReportingInternal(JNIEnv *env, jobject bridge) {
    msr_disable_anr_handler();
}

#ifdef __cplusplus
}
#endif