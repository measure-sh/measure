#include "jni_utils.h"

bool check_and_clear_exc(JNIEnv *env) {
    if ((*env)->ExceptionCheck(env)) {
        (*env)->ExceptionDescribe(env);
        (*env)->ExceptionClear(env);
        return true;
    }
    return false;
}

jclass safe_find_class(JNIEnv *env, const char *clz_name) {
    jclass clz = (*env)->FindClass(env, clz_name);
    if (check_and_clear_exc(env)) {
        return NULL;
    }
    return clz;
}

jmethodID safe_get_method_id(JNIEnv *env, jclass clz, const char *name, const char *sig) {
    if (clz == NULL) {
        return NULL;
    }
    jmethodID methodId = (*env)->GetMethodID(env, clz, name, sig);
    if (check_and_clear_exc(env)) {
        return NULL;
    }
    return methodId;
}
