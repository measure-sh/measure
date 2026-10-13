#include <jni.h>
#include <pthread.h>
#include <stdlib.h>

#define USE_AFTER_FREE_ATTEMPTS 100000

void __android_log_assert(const char *cond, const char *tag, const char *fmt, ...);

__attribute__((noinline)) static void write_through_null(void) {
    volatile int *pointer = NULL;
    *pointer = 42;
}

static void *crash_on_background_thread(void *arg) {
    (void)arg;
    write_through_null();
    return NULL;
}

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_segfault(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    write_through_null();
}

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_abortWithMessage(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    __android_log_assert("ptr != NULL", "frank", "Check failed: ptr != nullptr");
}

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_segfaultOnBackgroundThread(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    pthread_t thread;
    pthread_create(&thread, NULL, crash_on_background_thread, NULL);
    pthread_join(thread, NULL);
}

// GWP-ASan guards a sample of allocations, so repeat until a guarded one
// faults on the write after free.
__attribute__((noinline)) static void use_after_free(void) {
    for (int attempt = 0; attempt < USE_AFTER_FREE_ATTEMPTS; attempt++) {
        volatile char *buffer = malloc(32);
        free((void *)buffer);
        buffer[0] = 42;
    }
}

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_useAfterFree(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    use_after_free();
}

#include <stdint.h>

#define GWP_ASAN_ATTEMPTS 200000
#define PAGE_MASK_4K 0xfffu

static int starts_page(volatile char *p) { return ((uintptr_t)p & PAGE_MASK_4K) == 0; }

static int ends_page(volatile char *p) { return (((uintptr_t)p + 32) & PAGE_MASK_4K) == 0; }

#include <stdio.h>
#include <string.h>

static int in_gwp_asan(volatile char *p) {
    FILE *maps = fopen("/proc/self/maps", "r");
    if (!maps) return 0;
    char line[512];
    int found = 0;
    uintptr_t address = (uintptr_t)p & 0x00ffffffffffffffu;
    while (!found && fgets(line, sizeof(line), maps)) {
        unsigned long start, end;
        if (strstr(line, "GWP-ASan") && sscanf(line, "%lx-%lx", &start, &end) == 2) {
            found = address >= start && address < end;
        }
    }
    fclose(maps);
    return found;
}

__attribute__((noinline)) static void buffer_overflow(void) {
    for (int attempt = 0; attempt < GWP_ASAN_ATTEMPTS; attempt++) {
        volatile char *buffer = malloc(32);
        if (ends_page(buffer)) buffer[32] = 42;
    }
}

__attribute__((noinline)) static void buffer_underflow(void) {
    for (int attempt = 0; attempt < GWP_ASAN_ATTEMPTS; attempt++) {
        volatile char *buffer = malloc(32);
        if (starts_page(buffer)) buffer[-1] = 42;
    }
}

__attribute__((noinline)) static void double_free(void) {
    for (int attempt = 0; attempt < GWP_ASAN_ATTEMPTS; attempt++) {
        volatile char *buffer = malloc(32);
        if ((starts_page(buffer) || ends_page(buffer)) && in_gwp_asan(buffer)) {
            free((void *)buffer);
            free((void *)buffer);
        }
    }
}

__attribute__((noinline)) static void invalid_free(void) {
    for (int attempt = 0; attempt < GWP_ASAN_ATTEMPTS; attempt++) {
        volatile char *buffer = malloc(32);
        if ((starts_page(buffer) || ends_page(buffer)) && in_gwp_asan(buffer)) free((void *)(buffer + 8));
    }
}

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_bufferOverflow(JNIEnv *env, jobject self) { (void)env; (void)self; buffer_overflow(); }

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_bufferUnderflow(JNIEnv *env, jobject self) { (void)env; (void)self; buffer_underflow(); }

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_doubleFree(JNIEnv *env, jobject self) { (void)env; (void)self; double_free(); }

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_invalidFree(JNIEnv *env, jobject self) { (void)env; (void)self; invalid_free(); }
