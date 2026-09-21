#include <jni.h>
#include <stdlib.h>
#include <unistd.h>

#define CHUNK_MB 100
#define CHUNK_BYTES ((size_t)CHUNK_MB * 1024 * 1024)

typedef struct Allocation {
    struct Allocation *next;
    unsigned char bytes[CHUNK_BYTES];
} Allocation;

// Access is serialized by NativeMemory's synchronized JNI methods. Allocations
// intentionally survive navigation until explicitly released or the process exits.
static Allocation *allocations = NULL;
static jlong held_mb = 0;

JNIEXPORT jlong JNICALL
Java_sh_frankenstein_android_NativeMemory_allocate100Mb(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    Allocation *allocation = malloc(sizeof(Allocation));
    if (allocation == NULL) {
        return -1;
    }

    // Fault in every page: malloc alone can reserve address space without
    // contributing to anonymous RSS. Volatile prevents dead-store elimination.
    const long page_size = sysconf(_SC_PAGESIZE);
    const size_t stride = page_size > 0 ? (size_t)page_size : 4096;
    volatile unsigned char *bytes = allocation->bytes;
    for (size_t offset = 0; offset < CHUNK_BYTES; offset += stride) {
        bytes[offset] = 1;
    }
    bytes[CHUNK_BYTES - 1] = 1;

    allocation->next = allocations;
    allocations = allocation;
    held_mb += CHUNK_MB;
    return held_mb;
}

JNIEXPORT void JNICALL
Java_sh_frankenstein_android_NativeMemory_release(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    while (allocations != NULL) {
        Allocation *next = allocations->next;
        free(allocations);
        allocations = next;
    }
    held_mb = 0;
}

JNIEXPORT jlong JNICALL
Java_sh_frankenstein_android_NativeMemory_heldMb(JNIEnv *env, jobject self) {
    (void)env;
    (void)self;
    return held_mb;
}
