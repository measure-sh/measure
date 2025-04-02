#include <pthread.h>
#include "anr_handler.h"
#include "jni_utils.h"
#include <sys/syscall.h>
#include <unistd.h>
#include <android/log.h>
#include <stdio.h>
#include <dirent.h>
#include <stdlib.h>
#include <string.h>
#include <semaphore.h>

#define MSR_LOG_TAG "MeasureNdk"
#define MSR_LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, MSR_LOG_TAG, __VA_ARGS__)
#define MSR_LOGE(...) __android_log_print(ANDROID_LOG_ERROR, MSR_LOG_TAG, __VA_ARGS__)

static bool is_anr_handler_enabled = false;
static pthread_mutex_t anr_handler_lock = PTHREAD_MUTEX_INITIALIZER;

static pthread_t watchdog_thread;
static sem_t watchdog_thread_semaphore;

static JavaVM *jvm = NULL;
static pthread_key_t jni_cleanup_key;

static jobject gBridgeObj = NULL;
static jmethodID notifyAnrDetectedMethod = NULL;

static pid_t signal_catcher_tid = -1;
static pid_t process_id = -1;

static void detach_env(void *env) {
    if (jvm != NULL && env != NULL) {
        (*jvm)->DetachCurrentThread(jvm);
    }
}

static bool is_thread_named_signal_catcher(pid_t tid) {
    static const char *const SIGNAL_CATCHER_THREAD_NAME = "Signal Catcher";

    bool success = false;
    char buff[256];

    snprintf(buff, sizeof(buff), "/proc/%d/comm", tid);
    FILE *fp = fopen(buff, "r");
    if (fp == NULL) {
        return false;
    }

    if (fgets(buff, sizeof(buff), fp) != NULL) {
        success = strncmp(buff, SIGNAL_CATCHER_THREAD_NAME,
                          strlen(SIGNAL_CATCHER_THREAD_NAME)) == 0;
    }

    fclose(fp);
    return success;
}

static inline uint64_t sigmask_for_signal(uint64_t sig) {
    return (((uint64_t) 1) << (sig - 1));
}

static bool is_sigquit_blocked(pid_t tid) {
    static const char *SIGBLK_HEADER = "SigBlk:\t";
    const size_t SIGBLK_HEADER_LENGTH = strlen(SIGBLK_HEADER);

    char buff[256];
    uint64_t sigblk = 0;

    snprintf(buff, sizeof(buff), "/proc/%d/status", tid);
    FILE *fp = fopen(buff, "r");
    if (fp == NULL) {
        return false;
    }

    while (fgets(buff, sizeof(buff), fp) != NULL) {
        if (strncmp(buff, SIGBLK_HEADER, SIGBLK_HEADER_LENGTH) == 0) {
            sigblk = strtoull(buff + SIGBLK_HEADER_LENGTH, NULL, 16);
            break;
        }
    }
    fclose(fp);
    return (sigblk & sigmask_for_signal(SIGQUIT)) == 0;
}

static bool init_signal_catcher_tid() {
    pid_t pid = getpid();
    pid_t tid = -1;

    char path[256];
    snprintf(path, sizeof(path), "/proc/%d/task", pid);
    DIR *dir = opendir(path);
    if (dir == NULL) {
        return false;
    }

    struct dirent *dent;
    while ((dent = readdir(dir)) != NULL) {
        if (dent->d_name[0] < '0' || dent->d_name[0] > '9') {
            continue;
        }

        tid = strtol(dent->d_name, NULL, 10);
        if (is_thread_named_signal_catcher(tid) &&
                is_sigquit_blocked(tid)) {
            break;
        }
        tid = -1;
    }
    closedir(dir);

    if (tid < 0) {
        return false;
    }

    signal_catcher_tid = tid;
    process_id = pid;
    return true;
}

static void notifyAnrDetected(long long timeMs) {
    if (!is_anr_handler_enabled) {
        MSR_LOGD("ANR handler not enabled, discarding detected ANR");
        return;
    }
    if (jvm == NULL) {
        MSR_LOGE("JavaVM not initialized");
        return;
    }
    if (gBridgeObj == NULL || notifyAnrDetectedMethod == NULL) {
        MSR_LOGE("JNI class or methods not initialized");
        return;
    }

    JNIEnv *env;
    int result = (*jvm)->GetEnv(jvm, (void **) &env, JNI_VERSION_1_6);
    switch (result) {
        case JNI_OK:
            break;
        case JNI_EDETACHED:
            if ((*jvm)->AttachCurrentThread(jvm, &env, NULL) != JNI_OK) {
                MSR_LOGE("Failed to attach current thread");
                return;
            }
            if (env == NULL) {
                MSR_LOGE("Failed to get JNIEnv");
                return;
            }
            pthread_setspecific(jni_cleanup_key, env);
            break;
        case JNI_EVERSION:
            MSR_LOGE("JNI version not supported");
            return;
        default:
            break;
    }

    MSR_LOGD("ANR detected at %lld, notifying via JNI", timeMs);
    (*env)->CallVoidMethod(env, gBridgeObj, notifyAnrDetectedMethod, timeMs);
    if (check_and_clear_exc(env)) {
        MSR_LOGE("Failed to call notifyAnrDetected");
    }
}

static long long get_current_time_ms() {
    struct timespec ts;
    if (clock_gettime(CLOCK_REALTIME, &ts) == -1) {
        MSR_LOGE("Failed to get current time");
        return -1;
    }
    return (long long)ts.tv_sec * 1000LL;
}

static void block_sigquit() {
    sigset_t mask;
    sigemptyset(&mask);
    sigaddset(&mask, SIGQUIT);
    if (pthread_sigmask(SIG_BLOCK, &mask, NULL) != 0) {
        MSR_LOGE("Failed to block SIGQUIT");
    }
}

static void unblock_sigquit() {
    sigset_t mask;
    sigemptyset(&mask);
    sigaddset(&mask, SIGQUIT);
    if (pthread_sigmask(SIG_UNBLOCK, &mask, NULL) != 0) {
        MSR_LOGE("Failed to unblock SIGQUIT");
    }
}

static void *watchdog_start_routine(__unused void *_) {
    for (;;) {
        if (sem_wait(&watchdog_thread_semaphore) != 0) {
            MSR_LOGE("Failed to wait on semaphore, ANR detection won't work");
            break;
        }
        long long time = get_current_time_ms();
        notifyAnrDetected(time);
        syscall(SYS_tgkill, process_id, signal_catcher_tid, SIGQUIT);
        unblock_sigquit();
    }
    return NULL;
}

static void handle_sigquit(__unused int signal, __unused siginfo_t *_, __unused void *__) {
    // block SIGQUIT again to allow android signal catcher to receive the signal
    // this will be unblocked in notifyAnrDetected.
    block_sigquit();
    if (sem_post(&watchdog_thread_semaphore) != 0) {
        MSR_LOGE("Failed to notify SIGQUIT as semaphore post failed");
    }
}

static bool install_signal_handler() {
    struct sigaction sa;
    sa.sa_sigaction = handle_sigquit;
    sa.sa_flags = SA_SIGINFO;
    sigemptyset(&sa.sa_mask);
    return sigaction(SIGQUIT, &sa, NULL) == 0;
}

static bool init_jni(JNIEnv *env, jobject bridge) {
    if (env == NULL || bridge == NULL) {
        MSR_LOGE("Invalid JNI environment or bridge");
        return false;
    }

    jclass bridgeClass = safe_find_class(env, "sh/measure/android/NativeBridgeImpl");
    if (bridgeClass == NULL) {
        MSR_LOGE("Failed to find NativeBridgeImpl class");
        return false;
    }

    // get the method id of the notifyAnrDetected method
    notifyAnrDetectedMethod = safe_get_method_id(env, bridgeClass, "notifyAnrDetected", "(J)V");
    if (notifyAnrDetectedMethod == NULL) {
        MSR_LOGE("Failed to get notifyAnrDetected method id");
        return false;
    }

    // Create a global reference for the bridge object
    gBridgeObj = (*env)->NewGlobalRef(env, bridge);
    if (gBridgeObj == NULL) {
        MSR_LOGE("Failed to create global reference for ");
        return false;
    }

    // get the JavaVM instance
    int result = (*env)->GetJavaVM(env, &jvm);
    if (result != JNI_OK) {
        MSR_LOGE("Failed to get JavaVM");
        return false;
    }

    pthread_key_create(&jni_cleanup_key, detach_env);
    return true;
}

bool msr_enable_anr_handler(JNIEnv *env, jobject bridge) {
    pthread_mutex_lock(&anr_handler_lock);
    if (!init_jni(env, bridge)) {
        MSR_LOGE("Failed to initialize JNI");
        pthread_mutex_unlock(&anr_handler_lock);
        return false;
    }

    if (sem_init(&watchdog_thread_semaphore, /* pshared */ 0, /* initial */ 0) != 0) {
        MSR_LOGD("Failed to init semaphore");
    }

    // get the thread id of the Android "Signal Catcher" thread
    if (!init_signal_catcher_tid()) {
        MSR_LOGD("Failed to get Android signal catcher thread id");
    }

    // create a watchdog thread to monitor change to sigquit_detected
    if (pthread_create(&watchdog_thread, NULL, watchdog_start_routine, NULL) != 0) {
        MSR_LOGE("Failed to create watchdog thread");
        pthread_mutex_unlock(&anr_handler_lock);
        return false;
    }

    // install signal handler for SIGQUIT
    if (!install_signal_handler()) {
        MSR_LOGE("Failed to install signal handler for SIGQUIT");
        pthread_detach(watchdog_thread);
        pthread_mutex_unlock(&anr_handler_lock);
        return false;
    }

    // unblock SIGQUIT to break the Android "Signal Catcher" from receiving the signal
    unblock_sigquit();

    is_anr_handler_enabled = true;
    pthread_mutex_unlock(&anr_handler_lock);
    return true;
}

void msr_disable_anr_handler(void) {
    pthread_mutex_lock(&anr_handler_lock);
    is_anr_handler_enabled = false;
    pthread_mutex_unlock(&anr_handler_lock);
}
