package sh.frankenstein.android

import androidx.annotation.Keep

@Keep
internal object NativeCrash {
    init {
        System.loadLibrary("frank_crash")
    }

    external fun segfault()

    external fun abortWithMessage()

    external fun segfaultOnBackgroundThread()

    external fun useAfterFree()

    external fun bufferOverflow()

    external fun bufferUnderflow()

    external fun doubleFree()

    external fun invalidFree()
}
