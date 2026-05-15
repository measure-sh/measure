#include <jni.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

bool msr_enable_anr_handler(JNIEnv *env, jobject plugin);

void msr_disable_anr_handler(void);

#ifdef __cplusplus
}
#endif
