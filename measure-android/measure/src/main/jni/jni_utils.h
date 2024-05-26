#include <jni.h>
#include <stdbool.h>

bool check_and_clear_exc(JNIEnv *env);

jclass safe_find_class(JNIEnv *env, const char *clz_name);

jmethodID safe_get_method_id(JNIEnv *env, jclass clz, const char *name, const char *sig);
