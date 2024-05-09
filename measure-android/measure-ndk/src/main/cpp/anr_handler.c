#include <pthread.h>
#include "anr_handler.h"

// Whether the ANR tracking is enabled or not.
static bool enabled = false;
static pthread_mutex_t enable_anr_lock = PTHREAD_MUTEX_INITIALIZER;

bool msr_enable_anr_handler(JNIEnv *env, jobject bridge) {
    pthread_mutex_lock(&enable_anr_lock);
    enabled = true;
    pthread_mutex_unlock(&enable_anr_lock);
    return true;
}

void msr_disable_anr_handler(void) {
    pthread_mutex_lock(&enable_anr_lock);
    enabled = false;
    pthread_mutex_unlock(&enable_anr_lock);
}