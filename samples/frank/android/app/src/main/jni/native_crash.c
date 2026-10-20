#include <jni.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ATTEMPTS 200000
#define PAGE_MASK_4K 0xfffu
#define BUFFER_SIZE 32

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
    for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
        volatile char *buffer = malloc(BUFFER_SIZE);
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

static int starts_page(volatile char *buffer) {
    return ((uintptr_t)buffer & PAGE_MASK_4K) == 0;
}

static int ends_page(volatile char *buffer) {
    return (((uintptr_t)buffer + BUFFER_SIZE) & PAGE_MASK_4K) == 0;
}

// Only GWP-ASan reports the bad access. On the regular heap an overflow
// silently corrupts a neighbour and a bad free aborts in Scudo instead.
static int in_gwp_asan(volatile char *buffer) {
    FILE *maps = fopen("/proc/self/maps", "r");
    if (!maps) return 0;
    char line[512];
    int found = 0;
    uintptr_t address = (uintptr_t)buffer & 0x00ffffffffffffffu;
    while (!found && fgets(line, sizeof(line), maps)) {
        unsigned long start, end;
        if (strstr(line, "GWP-ASan") && sscanf(line, "%lx-%lx", &start, &end) == 2) {
            found = address >= start && address < end;
        }
    }
    fclose(maps);
    return found;
}

// GWP-ASan places a guarded allocation against the guard page on one side
// at random, so keep allocating until one sits on the side being tested.
// Buffers that don't match are freed so GWP-ASan can reuse its slots.
__attribute__((noinline)) static void buffer_overflow(void) {
    for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
        volatile char *buffer = malloc(BUFFER_SIZE);
        if (ends_page(buffer) && in_gwp_asan(buffer)) {
            buffer[BUFFER_SIZE] = 42;
        }
        free((void *)buffer);
    }
}

__attribute__((noinline)) static void buffer_underflow(void) {
    for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
        volatile char *buffer = malloc(BUFFER_SIZE);
        if (starts_page(buffer) && in_gwp_asan(buffer)) {
            buffer[-1] = 42;
        }
        free((void *)buffer);
    }
}

__attribute__((noinline)) static void double_free(void) {
    for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
        volatile char *buffer = malloc(BUFFER_SIZE);
        if ((starts_page(buffer) || ends_page(buffer)) && in_gwp_asan(buffer)) {
            free((void *)buffer);
        }
        free((void *)buffer);
    }
}

__attribute__((noinline)) static void invalid_free(void) {
    for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
        volatile char *buffer = malloc(BUFFER_SIZE);
        if ((starts_page(buffer) || ends_page(buffer)) && in_gwp_asan(buffer)) {
            free((void *)(buffer + 8));
        }
        free((void *)buffer);
    }
}

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_bufferOverflow(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    buffer_overflow();
}

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_bufferUnderflow(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    buffer_underflow();
}

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_doubleFree(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    double_free();
}

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeCrash_invalidFree(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    invalid_free();
}
