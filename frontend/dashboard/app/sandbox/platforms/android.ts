import { stableUuid } from "../query";
import type { ExceptionSpec, PlatformScenario } from "../scenario";
import { SPAN_STEPS, shopSpans, standardFlows } from "../journeys";

// The Android SDK collects other threads with Thread.getAllStackTraces(), which
// leaves out the thread that threw and every native thread.
const androidExceptions: ExceptionSpec[] = [
  {
    key: "npe_checkout",
    kind: "exception",
    type: "java.lang.NullPointerException",
    message:
      "Attempt to invoke virtual method 'java.lang.String com.acme.shop.data.Cart.getId()' on a null object reference",
    severity: "fatal",
    handled: false,
    foreground: true,
    framework: "jvm",
    exceptions: [
      {
        type: "java.lang.NullPointerException",
        message:
          "Attempt to invoke virtual method 'java.lang.String com.acme.shop.data.Cart.getId()' on a null object reference",
        frames: [
          {
            class_name: "com.acme.shop.checkout.CheckoutViewModel",
            method_name: "onPlaceOrderClicked",
            file_name: "CheckoutViewModel.kt",
            line_num: 88,
            in_app: true,
          },
          {
            class_name: "com.acme.shop.checkout.CheckoutViewModel",
            method_name: "access$onPlaceOrderClicked",
            file_name: "CheckoutViewModel.kt",
            line_num: 38,
            in_app: true,
          },
          {
            class_name:
              "com.acme.shop.checkout.CheckoutViewModel$onPlaceOrderClicked$1",
            method_name: "invokeSuspend",
            file_name: "CheckoutViewModel.kt",
            line_num: 72,
            in_app: true,
          },
          {
            class_name: "kotlin.coroutines.jvm.internal.BaseContinuationImpl",
            method_name: "resumeWith",
            file_name: "ContinuationImpl.kt",
            line_num: 33,
            in_app: false,
          },
          {
            class_name: "kotlinx.coroutines.DispatchedTask",
            method_name: "run",
            file_name: "DispatchedTask.kt",
            line_num: 104,
            in_app: false,
          },
          {
            class_name: "android.os.Handler",
            method_name: "handleCallback",
            file_name: "Handler.java",
            line_num: 942,
            in_app: false,
          },
          {
            class_name: "android.os.Handler",
            method_name: "dispatchMessage",
            file_name: "Handler.java",
            line_num: 99,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loopOnce",
            file_name: "Looper.java",
            line_num: 201,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loop",
            file_name: "Looper.java",
            line_num: 288,
            in_app: false,
          },
          {
            class_name: "android.app.ActivityThread",
            method_name: "main",
            file_name: "ActivityThread.java",
            line_num: 7918,
            in_app: false,
          },
          {
            class_name: "java.lang.reflect.Method",
            method_name: "invoke",
            file_name: "Method.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name:
              "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
            method_name: "run",
            file_name: "RuntimeInit.java",
            line_num: 548,
            in_app: false,
          },
          {
            class_name: "com.android.internal.os.ZygoteInit",
            method_name: "main",
            file_name: "ZygoteInit.java",
            line_num: 936,
            in_app: false,
          },
        ],
      },
    ],
    threads: [
      {
        name: "OkHttp Dispatcher",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "parkNanos",
            file_name: "LockSupport.java",
            line_num: 252,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.SynchronousQueue$TransferStack",
            method_name: "transfer",
            file_name: "SynchronousQueue.java",
            line_num: 401,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.SynchronousQueue",
            method_name: "poll",
            file_name: "SynchronousQueue.java",
            line_num: 903,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1070,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "OkHttp ConnectionPool",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner$RealBackend",
            method_name: "coordinatorWait",
            file_name: "TaskRunner.kt",
            line_num: 294,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner",
            method_name: "awaitTaskToRun",
            file_name: "TaskRunner.kt",
            line_num: 218,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner$runnable$1",
            method_name: "run",
            file_name: "TaskRunner.kt",
            line_num: 59,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "DefaultDispatcher-worker-1",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "parkNanos",
            file_name: "LockSupport.java",
            line_num: 376,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "park",
            file_name: "CoroutineScheduler.kt",
            line_num: 855,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "tryPark",
            file_name: "CoroutineScheduler.kt",
            line_num: 803,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "runWorker",
            file_name: "CoroutineScheduler.kt",
            line_num: 751,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "run",
            file_name: "CoroutineScheduler.kt",
            line_num: 704,
            in_app: false,
          },
        ],
      },
      {
        name: "DefaultDispatcher-worker-3",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "parkNanos",
            file_name: "LockSupport.java",
            line_num: 376,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "park",
            file_name: "CoroutineScheduler.kt",
            line_num: 855,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "tryPark",
            file_name: "CoroutineScheduler.kt",
            line_num: 803,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "runWorker",
            file_name: "CoroutineScheduler.kt",
            line_num: 751,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "run",
            file_name: "CoroutineScheduler.kt",
            line_num: 704,
            in_app: false,
          },
        ],
      },
      {
        name: "msr-export",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "park",
            file_name: "LockSupport.java",
            line_num: 341,
            in_app: false,
          },
          {
            class_name:
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode",
            method_name: "block",
            file_name: "AbstractQueuedSynchronizer.java",
            line_num: 506,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ForkJoinPool",
            method_name: "managedBlock",
            file_name: "ForkJoinPool.java",
            line_num: 3437,
            in_app: false,
          },
          {
            class_name:
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue",
            method_name: "take",
            file_name: "ScheduledThreadPoolExecutor.java",
            line_num: 1176,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1071,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "FinalizerDaemon",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "java.lang.ref.ReferenceQueue",
            method_name: "remove",
            file_name: "ReferenceQueue.java",
            line_num: 207,
            in_app: false,
          },
          {
            class_name: "java.lang.ref.ReferenceQueue",
            method_name: "remove",
            file_name: "ReferenceQueue.java",
            line_num: 228,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$FinalizerDaemon",
            method_name: "runInternal",
            file_name: "Daemons.java",
            line_num: 331,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$Daemon",
            method_name: "run",
            file_name: "Daemons.java",
            line_num: 131,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "ReferenceQueueDaemon",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 543,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$ReferenceQueueDaemon",
            method_name: "runInternal",
            file_name: "Daemons.java",
            line_num: 251,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$Daemon",
            method_name: "run",
            file_name: "Daemons.java",
            line_num: 131,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "queued-work-looper",
        frames: [
          {
            class_name: "android.os.MessageQueue",
            method_name: "nativePollOnce",
            file_name: "MessageQueue.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "android.os.MessageQueue",
            method_name: "next",
            file_name: "MessageQueue.java",
            line_num: 335,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loopOnce",
            file_name: "Looper.java",
            line_num: 161,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loop",
            file_name: "Looper.java",
            line_num: 288,
            in_app: false,
          },
          {
            class_name: "android.os.HandlerThread",
            method_name: "run",
            file_name: "HandlerThread.java",
            line_num: 67,
            in_app: false,
          },
        ],
      },
    ],
    file_name: "CheckoutViewModel.kt",
    method_name: "onPlaceOrderClicked",
    line_number: 88,
    stacktrace: `java.lang.NullPointerException: Attempt to invoke virtual method 'java.lang.String com.acme.shop.data.Cart.getId()' on a null object reference
	at com.acme.shop.checkout.CheckoutViewModel.onPlaceOrderClicked(CheckoutViewModel.kt:88)
	at com.acme.shop.checkout.CheckoutViewModel.access$onPlaceOrderClicked(CheckoutViewModel.kt:38)
	at com.acme.shop.checkout.CheckoutViewModel$onPlaceOrderClicked$1.invokeSuspend(CheckoutViewModel.kt:72)
	at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:33)
	at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:104)
	at android.os.Handler.handleCallback(Handler.java:942)
	at android.os.Handler.dispatchMessage(Handler.java:99)
	at android.os.Looper.loopOnce(Looper.java:201)
	at android.os.Looper.loop(Looper.java:288)
	at android.app.ActivityThread.main(ActivityThread.java:7918)
	at java.lang.reflect.Method.invoke(Method.java:-2)
	at com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)
	at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)`,
  },
  {
    key: "illegalstate_recyclerview",
    kind: "exception",
    type: "java.lang.IllegalStateException",
    message:
      "Cannot call this method while RecyclerView is computing a layout or scrolling",
    severity: "fatal",
    handled: false,
    foreground: true,
    framework: "jvm",
    exceptions: [
      {
        type: "java.lang.IllegalStateException",
        message:
          "Cannot call this method while RecyclerView is computing a layout or scrolling",
        frames: [
          {
            class_name: "androidx.recyclerview.widget.RecyclerView",
            method_name: "assertNotInLayoutOrScroll",
            file_name: "RecyclerView.java",
            line_num: 3648,
            in_app: false,
          },
          {
            class_name:
              "androidx.recyclerview.widget.RecyclerView$RecyclerViewDataObserver",
            method_name: "onItemRangeChanged",
            file_name: "RecyclerView.java",
            line_num: 5688,
            in_app: false,
          },
          {
            class_name:
              "androidx.recyclerview.widget.RecyclerView$AdapterDataObservable",
            method_name: "notifyItemRangeChanged",
            file_name: "RecyclerView.java",
            line_num: 12613,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.RecyclerView$Adapter",
            method_name: "notifyItemChanged",
            file_name: "RecyclerView.java",
            line_num: 7729,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.RecyclerView$Adapter",
            method_name: "notifyItemChanged",
            file_name: "RecyclerView.java",
            line_num: 7712,
            in_app: false,
          },
          {
            class_name:
              "com.acme.shop.catalog.ProductListActivity$ProductAdapter",
            method_name: "onBindViewHolder",
            file_name: "ProductListActivity.kt",
            line_num: 143,
            in_app: true,
          },
          {
            class_name:
              "com.acme.shop.catalog.ProductListActivity$ProductAdapter",
            method_name: "onBindViewHolder",
            file_name: "ProductListActivity.kt",
            line_num: 118,
            in_app: true,
          },
          {
            class_name: "androidx.recyclerview.widget.RecyclerView$Adapter",
            method_name: "onBindViewHolder",
            file_name: "RecyclerView.java",
            line_num: 7534,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.RecyclerView$Adapter",
            method_name: "bindViewHolder",
            file_name: "RecyclerView.java",
            line_num: 7577,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.RecyclerView$Recycler",
            method_name: "tryBindViewHolderByDeadline",
            file_name: "RecyclerView.java",
            line_num: 6479,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.RecyclerView$Recycler",
            method_name: "tryGetViewHolderForPositionByDeadline",
            file_name: "RecyclerView.java",
            line_num: 6746,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.RecyclerView$Recycler",
            method_name: "getViewForPosition",
            file_name: "RecyclerView.java",
            line_num: 6585,
            in_app: false,
          },
          {
            class_name:
              "androidx.recyclerview.widget.LinearLayoutManager$LayoutState",
            method_name: "next",
            file_name: "LinearLayoutManager.java",
            line_num: 2303,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.LinearLayoutManager",
            method_name: "layoutChunk",
            file_name: "LinearLayoutManager.java",
            line_num: 1627,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.LinearLayoutManager",
            method_name: "fill",
            file_name: "LinearLayoutManager.java",
            line_num: 1587,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.LinearLayoutManager",
            method_name: "scrollBy",
            file_name: "LinearLayoutManager.java",
            line_num: 1348,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.LinearLayoutManager",
            method_name: "scrollVerticallyBy",
            file_name: "LinearLayoutManager.java",
            line_num: 1113,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.RecyclerView",
            method_name: "scrollStep",
            file_name: "RecyclerView.java",
            line_num: 1917,
            in_app: false,
          },
          {
            class_name: "androidx.recyclerview.widget.RecyclerView$ViewFlinger",
            method_name: "run",
            file_name: "RecyclerView.java",
            line_num: 5666,
            in_app: false,
          },
          {
            class_name: "android.view.Choreographer$CallbackRecord",
            method_name: "run",
            file_name: "Choreographer.java",
            line_num: 1104,
            in_app: false,
          },
          {
            class_name: "android.view.Choreographer",
            method_name: "doCallbacks",
            file_name: "Choreographer.java",
            line_num: 899,
            in_app: false,
          },
          {
            class_name: "android.view.Choreographer",
            method_name: "doFrame",
            file_name: "Choreographer.java",
            line_num: 828,
            in_app: false,
          },
          {
            class_name: "android.view.Choreographer$FrameDisplayEventReceiver",
            method_name: "run",
            file_name: "Choreographer.java",
            line_num: 1089,
            in_app: false,
          },
          {
            class_name: "android.os.Handler",
            method_name: "handleCallback",
            file_name: "Handler.java",
            line_num: 942,
            in_app: false,
          },
          {
            class_name: "android.os.Handler",
            method_name: "dispatchMessage",
            file_name: "Handler.java",
            line_num: 99,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loopOnce",
            file_name: "Looper.java",
            line_num: 201,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loop",
            file_name: "Looper.java",
            line_num: 288,
            in_app: false,
          },
          {
            class_name: "android.app.ActivityThread",
            method_name: "main",
            file_name: "ActivityThread.java",
            line_num: 7918,
            in_app: false,
          },
          {
            class_name: "java.lang.reflect.Method",
            method_name: "invoke",
            file_name: "Method.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name:
              "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
            method_name: "run",
            file_name: "RuntimeInit.java",
            line_num: 548,
            in_app: false,
          },
          {
            class_name: "com.android.internal.os.ZygoteInit",
            method_name: "main",
            file_name: "ZygoteInit.java",
            line_num: 936,
            in_app: false,
          },
        ],
      },
    ],
    threads: [
      {
        name: "glide-source-thread-1",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "park",
            file_name: "LockSupport.java",
            line_num: 341,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.PriorityBlockingQueue",
            method_name: "take",
            file_name: "PriorityBlockingQueue.java",
            line_num: 573,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1071,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name:
              "com.bumptech.glide.load.engine.executor.GlideExecutor$DefaultThreadFactory$1",
            method_name: "run",
            file_name: "GlideExecutor.java",
            line_num: 416,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "glide-source-thread-2",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "park",
            file_name: "LockSupport.java",
            line_num: 341,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.PriorityBlockingQueue",
            method_name: "take",
            file_name: "PriorityBlockingQueue.java",
            line_num: 573,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1071,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name:
              "com.bumptech.glide.load.engine.executor.GlideExecutor$DefaultThreadFactory$1",
            method_name: "run",
            file_name: "GlideExecutor.java",
            line_num: 416,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "OkHttp Dispatcher",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "parkNanos",
            file_name: "LockSupport.java",
            line_num: 252,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.SynchronousQueue$TransferStack",
            method_name: "transfer",
            file_name: "SynchronousQueue.java",
            line_num: 401,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.SynchronousQueue",
            method_name: "poll",
            file_name: "SynchronousQueue.java",
            line_num: 903,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1070,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "OkHttp ConnectionPool",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner$RealBackend",
            method_name: "coordinatorWait",
            file_name: "TaskRunner.kt",
            line_num: 294,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner",
            method_name: "awaitTaskToRun",
            file_name: "TaskRunner.kt",
            line_num: 218,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner$runnable$1",
            method_name: "run",
            file_name: "TaskRunner.kt",
            line_num: 59,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "msr-export",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "park",
            file_name: "LockSupport.java",
            line_num: 341,
            in_app: false,
          },
          {
            class_name:
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode",
            method_name: "block",
            file_name: "AbstractQueuedSynchronizer.java",
            line_num: 506,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ForkJoinPool",
            method_name: "managedBlock",
            file_name: "ForkJoinPool.java",
            line_num: 3437,
            in_app: false,
          },
          {
            class_name:
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue",
            method_name: "take",
            file_name: "ScheduledThreadPoolExecutor.java",
            line_num: 1176,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1071,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "msr-io",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "park",
            file_name: "LockSupport.java",
            line_num: 341,
            in_app: false,
          },
          {
            class_name:
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode",
            method_name: "block",
            file_name: "AbstractQueuedSynchronizer.java",
            line_num: 506,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ForkJoinPool",
            method_name: "unmanagedBlock",
            file_name: "ForkJoinPool.java",
            line_num: 3466,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.LinkedBlockingQueue",
            method_name: "take",
            file_name: "LinkedBlockingQueue.java",
            line_num: 435,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1071,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "FinalizerWatchdogDaemon",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 543,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$FinalizerWatchdogDaemon",
            method_name: "sleepUntilNeeded",
            file_name: "Daemons.java",
            line_num: 464,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$FinalizerWatchdogDaemon",
            method_name: "runInternal",
            file_name: "Daemons.java",
            line_num: 444,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$Daemon",
            method_name: "run",
            file_name: "Daemons.java",
            line_num: 131,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "ConnectivityThread",
        frames: [
          {
            class_name: "android.os.MessageQueue",
            method_name: "nativePollOnce",
            file_name: "MessageQueue.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "android.os.MessageQueue",
            method_name: "next",
            file_name: "MessageQueue.java",
            line_num: 335,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loopOnce",
            file_name: "Looper.java",
            line_num: 161,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loop",
            file_name: "Looper.java",
            line_num: 288,
            in_app: false,
          },
          {
            class_name: "android.os.HandlerThread",
            method_name: "run",
            file_name: "HandlerThread.java",
            line_num: 67,
            in_app: false,
          },
        ],
      },
    ],
    file_name: "ProductListActivity.kt",
    method_name: "onBindViewHolder",
    line_number: 143,
    stacktrace: `java.lang.IllegalStateException: Cannot call this method while RecyclerView is computing a layout or scrolling
	at androidx.recyclerview.widget.RecyclerView.assertNotInLayoutOrScroll(RecyclerView.java:3648)
	at androidx.recyclerview.widget.RecyclerView$RecyclerViewDataObserver.onItemRangeChanged(RecyclerView.java:5688)
	at androidx.recyclerview.widget.RecyclerView$AdapterDataObservable.notifyItemRangeChanged(RecyclerView.java:12613)
	at androidx.recyclerview.widget.RecyclerView$Adapter.notifyItemChanged(RecyclerView.java:7729)
	at androidx.recyclerview.widget.RecyclerView$Adapter.notifyItemChanged(RecyclerView.java:7712)
	at com.acme.shop.catalog.ProductListActivity$ProductAdapter.onBindViewHolder(ProductListActivity.kt:143)
	at com.acme.shop.catalog.ProductListActivity$ProductAdapter.onBindViewHolder(ProductListActivity.kt:118)
	at androidx.recyclerview.widget.RecyclerView$Adapter.onBindViewHolder(RecyclerView.java:7534)
	at androidx.recyclerview.widget.RecyclerView$Adapter.bindViewHolder(RecyclerView.java:7577)
	at androidx.recyclerview.widget.RecyclerView$Recycler.tryBindViewHolderByDeadline(RecyclerView.java:6479)
	at androidx.recyclerview.widget.RecyclerView$Recycler.tryGetViewHolderForPositionByDeadline(RecyclerView.java:6746)
	at androidx.recyclerview.widget.RecyclerView$Recycler.getViewForPosition(RecyclerView.java:6585)
	at androidx.recyclerview.widget.LinearLayoutManager$LayoutState.next(LinearLayoutManager.java:2303)
	at androidx.recyclerview.widget.LinearLayoutManager.layoutChunk(LinearLayoutManager.java:1627)
	at androidx.recyclerview.widget.LinearLayoutManager.fill(LinearLayoutManager.java:1587)
	at androidx.recyclerview.widget.LinearLayoutManager.scrollBy(LinearLayoutManager.java:1348)
	at androidx.recyclerview.widget.LinearLayoutManager.scrollVerticallyBy(LinearLayoutManager.java:1113)
	at androidx.recyclerview.widget.RecyclerView.scrollStep(RecyclerView.java:1917)
	at androidx.recyclerview.widget.RecyclerView$ViewFlinger.run(RecyclerView.java:5666)
	at android.view.Choreographer$CallbackRecord.run(Choreographer.java:1104)
	at android.view.Choreographer.doCallbacks(Choreographer.java:899)
	at android.view.Choreographer.doFrame(Choreographer.java:828)
	at android.view.Choreographer$FrameDisplayEventReceiver.run(Choreographer.java:1089)
	at android.os.Handler.handleCallback(Handler.java:942)
	at android.os.Handler.dispatchMessage(Handler.java:99)
	at android.os.Looper.loopOnce(Looper.java:201)
	at android.os.Looper.loop(Looper.java:288)
	at android.app.ActivityThread.main(ActivityThread.java:7918)
	at java.lang.reflect.Method.invoke(Method.java:-2)
	at com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)
	at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)`,
  },
  {
    key: "anr_image_decode",
    kind: "anr",
    type: "sh.measure.android.anr.AnrError",
    message: "Application Not Responding for at least 5s",
    severity: "fatal",
    handled: false,
    foreground: true,
    framework: "jvm",
    exceptions: [
      {
        type: "sh.measure.android.anr.AnrError",
        message: "Application Not Responding for at least 5s",
        frames: [
          {
            class_name: "android.graphics.BitmapFactory",
            method_name: "nativeDecodeStream",
            file_name: "BitmapFactory.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "android.graphics.BitmapFactory",
            method_name: "decodeStreamInternal",
            file_name: "BitmapFactory.java",
            line_num: 907,
            in_app: false,
          },
          {
            class_name: "android.graphics.BitmapFactory",
            method_name: "decodeStream",
            file_name: "BitmapFactory.java",
            line_num: 883,
            in_app: false,
          },
          {
            class_name: "android.graphics.BitmapFactory",
            method_name: "decodeStream",
            file_name: "BitmapFactory.java",
            line_num: 960,
            in_app: false,
          },
          {
            class_name: "com.acme.shop.catalog.ProductDetailFragment",
            method_name: "decodeHeroBitmap$lambda$4",
            file_name: "ProductDetailFragment.kt",
            line_num: 149,
            in_app: true,
          },
          {
            class_name: "com.acme.shop.catalog.ProductDetailFragment",
            method_name: "decodeHeroBitmap",
            file_name: "ProductDetailFragment.kt",
            line_num: 141,
            in_app: true,
          },
          {
            class_name:
              "com.acme.shop.catalog.ProductDetailFragment$$ExternalSyntheticLambda2",
            method_name: "run",
            file_name: "Unknown Source",
            line_num: 2,
            in_app: true,
          },
          {
            class_name: "android.os.Handler",
            method_name: "handleCallback",
            file_name: "Handler.java",
            line_num: 942,
            in_app: false,
          },
          {
            class_name: "android.os.Handler",
            method_name: "dispatchMessage",
            file_name: "Handler.java",
            line_num: 99,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loopOnce",
            file_name: "Looper.java",
            line_num: 201,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loop",
            file_name: "Looper.java",
            line_num: 288,
            in_app: false,
          },
          {
            class_name: "android.app.ActivityThread",
            method_name: "main",
            file_name: "ActivityThread.java",
            line_num: 7918,
            in_app: false,
          },
          {
            class_name: "java.lang.reflect.Method",
            method_name: "invoke",
            file_name: "Method.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name:
              "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
            method_name: "run",
            file_name: "RuntimeInit.java",
            line_num: 548,
            in_app: false,
          },
          {
            class_name: "com.android.internal.os.ZygoteInit",
            method_name: "main",
            file_name: "ZygoteInit.java",
            line_num: 936,
            in_app: false,
          },
        ],
      },
    ],
    threads: [
      {
        name: "glide-source-thread-1",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "park",
            file_name: "LockSupport.java",
            line_num: 341,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.PriorityBlockingQueue",
            method_name: "take",
            file_name: "PriorityBlockingQueue.java",
            line_num: 573,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1071,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name:
              "com.bumptech.glide.load.engine.executor.GlideExecutor$DefaultThreadFactory$1",
            method_name: "run",
            file_name: "GlideExecutor.java",
            line_num: 416,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "OkHttp Dispatcher",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "parkNanos",
            file_name: "LockSupport.java",
            line_num: 252,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.SynchronousQueue$TransferStack",
            method_name: "transfer",
            file_name: "SynchronousQueue.java",
            line_num: 401,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.SynchronousQueue",
            method_name: "poll",
            file_name: "SynchronousQueue.java",
            line_num: 903,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1070,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "OkHttp ConnectionPool",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner$RealBackend",
            method_name: "coordinatorWait",
            file_name: "TaskRunner.kt",
            line_num: 294,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner",
            method_name: "awaitTaskToRun",
            file_name: "TaskRunner.kt",
            line_num: 218,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner$runnable$1",
            method_name: "run",
            file_name: "TaskRunner.kt",
            line_num: 59,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "DefaultDispatcher-worker-2",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "parkNanos",
            file_name: "LockSupport.java",
            line_num: 376,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "park",
            file_name: "CoroutineScheduler.kt",
            line_num: 855,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "tryPark",
            file_name: "CoroutineScheduler.kt",
            line_num: 803,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "runWorker",
            file_name: "CoroutineScheduler.kt",
            line_num: 751,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "run",
            file_name: "CoroutineScheduler.kt",
            line_num: 704,
            in_app: false,
          },
        ],
      },
      {
        name: "msr-export",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "park",
            file_name: "LockSupport.java",
            line_num: 341,
            in_app: false,
          },
          {
            class_name:
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode",
            method_name: "block",
            file_name: "AbstractQueuedSynchronizer.java",
            line_num: 506,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ForkJoinPool",
            method_name: "managedBlock",
            file_name: "ForkJoinPool.java",
            line_num: 3437,
            in_app: false,
          },
          {
            class_name:
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue",
            method_name: "take",
            file_name: "ScheduledThreadPoolExecutor.java",
            line_num: 1176,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1071,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "msr-io",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "park",
            file_name: "LockSupport.java",
            line_num: 341,
            in_app: false,
          },
          {
            class_name:
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode",
            method_name: "block",
            file_name: "AbstractQueuedSynchronizer.java",
            line_num: 506,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ForkJoinPool",
            method_name: "unmanagedBlock",
            file_name: "ForkJoinPool.java",
            line_num: 3466,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.LinkedBlockingQueue",
            method_name: "take",
            file_name: "LinkedBlockingQueue.java",
            line_num: 435,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1071,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "FinalizerDaemon",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "java.lang.ref.ReferenceQueue",
            method_name: "remove",
            file_name: "ReferenceQueue.java",
            line_num: 207,
            in_app: false,
          },
          {
            class_name: "java.lang.ref.ReferenceQueue",
            method_name: "remove",
            file_name: "ReferenceQueue.java",
            line_num: 228,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$FinalizerDaemon",
            method_name: "runInternal",
            file_name: "Daemons.java",
            line_num: 331,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$Daemon",
            method_name: "run",
            file_name: "Daemons.java",
            line_num: 131,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "FinalizerWatchdogDaemon",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 543,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$FinalizerWatchdogDaemon",
            method_name: "sleepUntilNeeded",
            file_name: "Daemons.java",
            line_num: 464,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$FinalizerWatchdogDaemon",
            method_name: "runInternal",
            file_name: "Daemons.java",
            line_num: 444,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$Daemon",
            method_name: "run",
            file_name: "Daemons.java",
            line_num: 131,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "queued-work-looper",
        frames: [
          {
            class_name: "android.os.MessageQueue",
            method_name: "nativePollOnce",
            file_name: "MessageQueue.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "android.os.MessageQueue",
            method_name: "next",
            file_name: "MessageQueue.java",
            line_num: 335,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loopOnce",
            file_name: "Looper.java",
            line_num: 161,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loop",
            file_name: "Looper.java",
            line_num: 288,
            in_app: false,
          },
          {
            class_name: "android.os.HandlerThread",
            method_name: "run",
            file_name: "HandlerThread.java",
            line_num: 67,
            in_app: false,
          },
        ],
      },
    ],
    file_name: "ProductDetailFragment.kt",
    method_name: "decodeHeroBitmap$lambda$4",
    line_number: 149,
    stacktrace: `sh.measure.android.anr.AnrError: Application Not Responding for at least 5s
	at android.graphics.BitmapFactory.nativeDecodeStream(BitmapFactory.java:-2)
	at android.graphics.BitmapFactory.decodeStreamInternal(BitmapFactory.java:907)
	at android.graphics.BitmapFactory.decodeStream(BitmapFactory.java:883)
	at android.graphics.BitmapFactory.decodeStream(BitmapFactory.java:960)
	at com.acme.shop.catalog.ProductDetailFragment.decodeHeroBitmap$lambda$4(ProductDetailFragment.kt:149)
	at com.acme.shop.catalog.ProductDetailFragment.decodeHeroBitmap(ProductDetailFragment.kt:141)
	at com.acme.shop.catalog.ProductDetailFragment$$ExternalSyntheticLambda2.run(Unknown Source:2)
	at android.os.Handler.handleCallback(Handler.java:942)
	at android.os.Handler.dispatchMessage(Handler.java:99)
	at android.os.Looper.loopOnce(Looper.java:201)
	at android.os.Looper.loop(Looper.java:288)
	at android.app.ActivityThread.main(ActivityThread.java:7918)
	at java.lang.reflect.Method.invoke(Method.java:-2)
	at com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)
	at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)`,
  },
  {
    key: "timeout_cart_handled",
    kind: "exception",
    type: "java.net.SocketTimeoutException",
    message: "timeout",
    severity: "handled",
    handled: true,
    foreground: true,
    framework: "jvm",
    exceptions: [
      {
        type: "java.net.SocketTimeoutException",
        message: "timeout",
        thread_name: "DefaultDispatcher-worker-2",
        frames: [
          {
            class_name: "okio.SocketAsyncTimeout",
            method_name: "newTimeoutException",
            file_name: "JvmOkio.kt",
            line_num: 147,
            in_app: false,
          },
          {
            class_name: "okio.AsyncTimeout",
            method_name: "access$newTimeoutException",
            file_name: "AsyncTimeout.kt",
            line_num: 161,
            in_app: false,
          },
          {
            class_name: "okio.AsyncTimeout$source$1",
            method_name: "read",
            file_name: "AsyncTimeout.kt",
            line_num: 337,
            in_app: false,
          },
          {
            class_name: "okio.RealBufferedSource",
            method_name: "indexOf",
            file_name: "RealBufferedSource.kt",
            line_num: 427,
            in_app: false,
          },
          {
            class_name: "okio.RealBufferedSource",
            method_name: "readUtf8LineStrict",
            file_name: "RealBufferedSource.kt",
            line_num: 320,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http1.HeadersReader",
            method_name: "readLine",
            file_name: "HeadersReader.kt",
            line_num: 29,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http1.Http1ExchangeCodec",
            method_name: "readResponseHeaders",
            file_name: "Http1ExchangeCodec.kt",
            line_num: 180,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.connection.Exchange",
            method_name: "readResponseHeaders",
            file_name: "Exchange.kt",
            line_num: 106,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http.CallServerInterceptor",
            method_name: "intercept",
            file_name: "CallServerInterceptor.kt",
            line_num: 79,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http.RealInterceptorChain",
            method_name: "proceed",
            file_name: "RealInterceptorChain.kt",
            line_num: 109,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.connection.ConnectInterceptor",
            method_name: "intercept",
            file_name: "ConnectInterceptor.kt",
            line_num: 34,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http.RealInterceptorChain",
            method_name: "proceed",
            file_name: "RealInterceptorChain.kt",
            line_num: 109,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.cache.CacheInterceptor",
            method_name: "intercept",
            file_name: "CacheInterceptor.kt",
            line_num: 95,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http.RealInterceptorChain",
            method_name: "proceed",
            file_name: "RealInterceptorChain.kt",
            line_num: 109,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http.BridgeInterceptor",
            method_name: "intercept",
            file_name: "BridgeInterceptor.kt",
            line_num: 83,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http.RealInterceptorChain",
            method_name: "proceed",
            file_name: "RealInterceptorChain.kt",
            line_num: 109,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http.RetryAndFollowUpInterceptor",
            method_name: "intercept",
            file_name: "RetryAndFollowUpInterceptor.kt",
            line_num: 76,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http.RealInterceptorChain",
            method_name: "proceed",
            file_name: "RealInterceptorChain.kt",
            line_num: 109,
            in_app: false,
          },
          {
            class_name:
              "sh.measure.android.okhttp.MeasureOkHttpApplicationInterceptor",
            method_name: "intercept",
            file_name: "MeasureOkHttpApplicationInterceptor.kt",
            line_num: 29,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.http.RealInterceptorChain",
            method_name: "proceed",
            file_name: "RealInterceptorChain.kt",
            line_num: 109,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.connection.RealCall",
            method_name: "getResponseWithInterceptorChain",
            file_name: "RealCall.kt",
            line_num: 201,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.connection.RealCall",
            method_name: "execute",
            file_name: "RealCall.kt",
            line_num: 154,
            in_app: false,
          },
          {
            class_name: "retrofit2.OkHttpCall",
            method_name: "execute",
            file_name: "OkHttpCall.java",
            line_num: 204,
            in_app: false,
          },
          {
            class_name: "com.acme.shop.cart.CartRepository",
            method_name: "validatePromoCode",
            file_name: "CartRepository.kt",
            line_num: 63,
            in_app: true,
          },
          {
            class_name: "com.acme.shop.cart.CartRepository$validatePromoCode$2",
            method_name: "invokeSuspend",
            file_name: "CartRepository.kt",
            line_num: 61,
            in_app: true,
          },
          {
            class_name: "kotlin.coroutines.jvm.internal.BaseContinuationImpl",
            method_name: "resumeWith",
            file_name: "ContinuationImpl.kt",
            line_num: 33,
            in_app: false,
          },
          {
            class_name: "kotlinx.coroutines.DispatchedTask",
            method_name: "run",
            file_name: "DispatchedTask.kt",
            line_num: 104,
            in_app: false,
          },
          {
            class_name: "kotlinx.coroutines.scheduling.CoroutineScheduler",
            method_name: "runSafely",
            file_name: "CoroutineScheduler.kt",
            line_num: 584,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "executeTask",
            file_name: "CoroutineScheduler.kt",
            line_num: 793,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "runWorker",
            file_name: "CoroutineScheduler.kt",
            line_num: 697,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "run",
            file_name: "CoroutineScheduler.kt",
            line_num: 684,
            in_app: false,
          },
        ],
      },
    ],
    threads: [
      {
        name: "main",
        frames: [
          {
            class_name: "android.os.MessageQueue",
            method_name: "nativePollOnce",
            file_name: "MessageQueue.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "android.os.MessageQueue",
            method_name: "next",
            file_name: "MessageQueue.java",
            line_num: 335,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loopOnce",
            file_name: "Looper.java",
            line_num: 161,
            in_app: false,
          },
          {
            class_name: "android.os.Looper",
            method_name: "loop",
            file_name: "Looper.java",
            line_num: 288,
            in_app: false,
          },
          {
            class_name: "android.app.ActivityThread",
            method_name: "main",
            file_name: "ActivityThread.java",
            line_num: 7918,
            in_app: false,
          },
          {
            class_name: "java.lang.reflect.Method",
            method_name: "invoke",
            file_name: "Method.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name:
              "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
            method_name: "run",
            file_name: "RuntimeInit.java",
            line_num: 548,
            in_app: false,
          },
          {
            class_name: "com.android.internal.os.ZygoteInit",
            method_name: "main",
            file_name: "ZygoteInit.java",
            line_num: 936,
            in_app: false,
          },
        ],
      },
      {
        name: "OkHttp Dispatcher",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "parkNanos",
            file_name: "LockSupport.java",
            line_num: 252,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.SynchronousQueue$TransferStack",
            method_name: "transfer",
            file_name: "SynchronousQueue.java",
            line_num: 401,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.SynchronousQueue",
            method_name: "poll",
            file_name: "SynchronousQueue.java",
            line_num: 903,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1070,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "OkHttp ConnectionPool",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner$RealBackend",
            method_name: "coordinatorWait",
            file_name: "TaskRunner.kt",
            line_num: 294,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner",
            method_name: "awaitTaskToRun",
            file_name: "TaskRunner.kt",
            line_num: 218,
            in_app: false,
          },
          {
            class_name: "okhttp3.internal.concurrent.TaskRunner$runnable$1",
            method_name: "run",
            file_name: "TaskRunner.kt",
            line_num: 59,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "Okio Watchdog",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "okio.AsyncTimeout$Companion",
            method_name: "awaitTimeout",
            file_name: "AsyncTimeout.kt",
            line_num: 313,
            in_app: false,
          },
          {
            class_name: "okio.AsyncTimeout$Watchdog",
            method_name: "run",
            file_name: "AsyncTimeout.kt",
            line_num: 189,
            in_app: false,
          },
        ],
      },
      {
        name: "DefaultDispatcher-worker-1",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "parkNanos",
            file_name: "LockSupport.java",
            line_num: 376,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "park",
            file_name: "CoroutineScheduler.kt",
            line_num: 855,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "tryPark",
            file_name: "CoroutineScheduler.kt",
            line_num: 803,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "runWorker",
            file_name: "CoroutineScheduler.kt",
            line_num: 751,
            in_app: false,
          },
          {
            class_name:
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker",
            method_name: "run",
            file_name: "CoroutineScheduler.kt",
            line_num: 704,
            in_app: false,
          },
        ],
      },
      {
        name: "msr-export",
        frames: [
          {
            class_name: "jdk.internal.misc.Unsafe",
            method_name: "park",
            file_name: "Unsafe.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.locks.LockSupport",
            method_name: "park",
            file_name: "LockSupport.java",
            line_num: 341,
            in_app: false,
          },
          {
            class_name:
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode",
            method_name: "block",
            file_name: "AbstractQueuedSynchronizer.java",
            line_num: 506,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ForkJoinPool",
            method_name: "managedBlock",
            file_name: "ForkJoinPool.java",
            line_num: 3437,
            in_app: false,
          },
          {
            class_name:
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue",
            method_name: "take",
            file_name: "ScheduledThreadPoolExecutor.java",
            line_num: 1176,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "getTask",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1071,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor",
            method_name: "runWorker",
            file_name: "ThreadPoolExecutor.java",
            line_num: 1131,
            in_app: false,
          },
          {
            class_name: "java.util.concurrent.ThreadPoolExecutor$Worker",
            method_name: "run",
            file_name: "ThreadPoolExecutor.java",
            line_num: 644,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
      {
        name: "FinalizerDaemon",
        frames: [
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: -2,
            in_app: false,
          },
          {
            class_name: "java.lang.Object",
            method_name: "wait",
            file_name: "Object.java",
            line_num: 405,
            in_app: false,
          },
          {
            class_name: "java.lang.ref.ReferenceQueue",
            method_name: "remove",
            file_name: "ReferenceQueue.java",
            line_num: 207,
            in_app: false,
          },
          {
            class_name: "java.lang.ref.ReferenceQueue",
            method_name: "remove",
            file_name: "ReferenceQueue.java",
            line_num: 228,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$FinalizerDaemon",
            method_name: "runInternal",
            file_name: "Daemons.java",
            line_num: 331,
            in_app: false,
          },
          {
            class_name: "java.lang.Daemons$Daemon",
            method_name: "run",
            file_name: "Daemons.java",
            line_num: 131,
            in_app: false,
          },
          {
            class_name: "java.lang.Thread",
            method_name: "run",
            file_name: "Thread.java",
            line_num: 1012,
            in_app: false,
          },
        ],
      },
    ],
    file_name: "CartRepository.kt",
    method_name: "validatePromoCode",
    line_number: 63,
    stacktrace: `java.net.SocketTimeoutException: timeout
	at okio.SocketAsyncTimeout.newTimeoutException(JvmOkio.kt:147)
	at okio.AsyncTimeout.access$newTimeoutException(AsyncTimeout.kt:161)
	at okio.AsyncTimeout$source$1.read(AsyncTimeout.kt:337)
	at okio.RealBufferedSource.indexOf(RealBufferedSource.kt:427)
	at okio.RealBufferedSource.readUtf8LineStrict(RealBufferedSource.kt:320)
	at okhttp3.internal.http1.HeadersReader.readLine(HeadersReader.kt:29)
	at okhttp3.internal.http1.Http1ExchangeCodec.readResponseHeaders(Http1ExchangeCodec.kt:180)
	at okhttp3.internal.connection.Exchange.readResponseHeaders(Exchange.kt:106)
	at okhttp3.internal.http.CallServerInterceptor.intercept(CallServerInterceptor.kt:79)
	at okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)
	at okhttp3.internal.connection.ConnectInterceptor.intercept(ConnectInterceptor.kt:34)
	at okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)
	at okhttp3.internal.cache.CacheInterceptor.intercept(CacheInterceptor.kt:95)
	at okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)
	at okhttp3.internal.http.BridgeInterceptor.intercept(BridgeInterceptor.kt:83)
	at okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)
	at okhttp3.internal.http.RetryAndFollowUpInterceptor.intercept(RetryAndFollowUpInterceptor.kt:76)
	at okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)
	at sh.measure.android.okhttp.MeasureOkHttpApplicationInterceptor.intercept(MeasureOkHttpApplicationInterceptor.kt:29)
	at okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)
	at okhttp3.internal.connection.RealCall.getResponseWithInterceptorChain(RealCall.kt:201)
	at okhttp3.internal.connection.RealCall.execute(RealCall.kt:154)
	at retrofit2.OkHttpCall.execute(OkHttpCall.java:204)
	at com.acme.shop.cart.CartRepository.validatePromoCode(CartRepository.kt:63)
	at com.acme.shop.cart.CartRepository$validatePromoCode$2.invokeSuspend(CartRepository.kt:61)
	at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:33)
	at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:104)
	at kotlinx.coroutines.scheduling.CoroutineScheduler.runSafely(CoroutineScheduler.kt:584)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.executeTask(CoroutineScheduler.kt:793)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:697)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:684)`,
  },
  {
    key: "gwp_asan_uaf_hero_blur",
    kind: "exception",
    type: "SIGSEGV",
    message: "Use After Free",
    severity: "fatal",
    handled: false,
    foreground: true,
    framework: "ndk",
    memory_error: {
      tool: "gwp_asan",
      type: "use_after_free",
      address: "0x79c2f4bfd0",
      size: 48,
      deallocation: {
        thread_id: 23741,
        thread_name: "main",
        frames: [
          "#00 pc 0x0000000000047c64  libc.so (gwp_asan::AllocationMetadata::CallSiteInfo::RecordBacktrace(unsigned long (*)(unsigned long*, unsigned long)))",
          "#01 pc 0x0000000000048388  libc.so (gwp_asan::GuardedPoolAllocator::deallocate(void*))",
          "#02 pc 0x000000000001c7f0  libacme_imaging.so (acme::RowCache::evict(unsigned long)) (row_cache.cpp:54)",
          "#03 pc 0x000000000001c5d8  libacme_imaging.so (acme::RowCache::trimTo(unsigned long)) (row_cache.cpp:71)",
          "#04 pc 0x000000000001ba64  libacme_imaging.so (Java_com_acme_shop_imaging_NativeBlur_nativeTrimMemory) (native_blur.cpp:44)",
          "#05 pc 0x0000000000222244  libart.so (art_quick_generic_jni_trampoline)",
        ],
      },
      allocation: {
        thread_id: 23790,
        thread_name: "glide-source-thread-1",
        frames: [
          "#00 pc 0x0000000000047c64  libc.so (gwp_asan::AllocationMetadata::CallSiteInfo::RecordBacktrace(unsigned long (*)(unsigned long*, unsigned long)))",
          "#01 pc 0x0000000000048294  libc.so (gwp_asan::GuardedPoolAllocator::allocate(unsigned long, unsigned long))",
          "#02 pc 0x000000000003c298  libc.so (gwp_asan_malloc(unsigned long))",
          "#03 pc 0x000000000003ccc4  libc.so (malloc)",
          "#04 pc 0x000000000001c3b8  libacme_imaging.so (acme::RowCache::acquire(int)) (row_cache.cpp:32)",
          "#05 pc 0x000000000001e05c  libacme_imaging.so (acme::BlurFilter::apply(acme::Bitmap&, int)) (blur_filter.cpp:36)",
          "#06 pc 0x000000000001b9a0  libacme_imaging.so (Java_com_acme_shop_imaging_NativeBlur_nativeApply) (native_blur.cpp:27)",
          "#07 pc 0x0000000000222244  libart.so (art_quick_generic_jni_trampoline)",
        ],
      },
    },
    cause: "Use After Free, 16 bytes into a 48-byte allocation at 0x79c2f4bfd0",
    exceptions: [
      {
        type: "SIGSEGV",
        message: "SEGV_ACCERR at 0xb4000079c2f4bfe0",
        signal: "SIGSEGV",
        thread_name: "glide-source-thread-1",
        frames: [
          {
            frame_index: 0,
            binary_name: "libacme_imaging.so",
            offset: 0x1e2c8,
            method_name:
              "acme::BlurFilter::blurRow(unsigned char const*, unsigned char*, int)",
            file_name: "blur_filter.cpp",
            line_num: 88,
            in_app: true,
          },
          {
            frame_index: 1,
            binary_name: "libacme_imaging.so",
            offset: 0x1e0f4,
            method_name: "acme::BlurFilter::apply(acme::Bitmap&, int)",
            file_name: "blur_filter.cpp",
            line_num: 41,
            in_app: true,
          },
          {
            frame_index: 2,
            binary_name: "libacme_imaging.so",
            offset: 0x1b9a0,
            method_name: "Java_com_acme_shop_imaging_NativeBlur_nativeApply",
            file_name: "native_blur.cpp",
            line_num: 27,
            in_app: true,
          },
          {
            frame_index: 3,
            binary_name: "libart.so",
            offset: 0x222244,
            method_name: "art_quick_generic_jni_trampoline",
            in_app: false,
          },
          {
            frame_index: 4,
            binary_name: "libart.so",
            offset: 0x218be8,
            method_name: "art_quick_invoke_stub",
            in_app: false,
          },
          {
            frame_index: 5,
            binary_name: "libart.so",
            offset: 0x2a3f1c,
            method_name:
              "art::ArtMethod::Invoke(art::Thread*, unsigned int*, unsigned int, art::JValue*, char const*)",
            in_app: false,
          },
          {
            frame_index: 6,
            binary_name: "libart.so",
            offset: 0x4b6d30,
            method_name:
              "art::interpreter::ArtInterpreterToCompiledCodeBridge(art::Thread*, art::ArtMethod*, art::ShadowFrame*, unsigned short, art::JValue*)",
            in_app: false,
          },
          {
            frame_index: 7,
            binary_name: "base.odex",
            offset: 0x52c6e8,
            method_name: "com.acme.shop.imaging.NativeBlur.apply",
            in_app: false,
          },
          {
            frame_index: 8,
            binary_name: "base.odex",
            offset: 0x52c41c,
            method_name:
              "com.acme.shop.imaging.HeroBlurTransformation.transform",
            in_app: false,
          },
          {
            frame_index: 9,
            binary_name: "base.odex",
            offset: 0x4e81c4,
            method_name:
              "com.bumptech.glide.load.resource.bitmap.BitmapTransformation.transform",
            in_app: false,
          },
          {
            frame_index: 10,
            binary_name: "base.odex",
            offset: 0x4d2a58,
            method_name:
              "com.bumptech.glide.load.engine.DecodeJob.transformEncodeAndTranscode",
            in_app: false,
          },
          {
            frame_index: 11,
            binary_name: "base.odex",
            offset: 0x4d1f9c,
            method_name:
              "com.bumptech.glide.load.engine.DecodeJob.decodeFromRetrievedData",
            in_app: false,
          },
          {
            frame_index: 12,
            binary_name: "base.odex",
            offset: 0x4d0b40,
            method_name: "com.bumptech.glide.load.engine.DecodeJob.run",
            in_app: false,
          },
          {
            frame_index: 13,
            binary_name: "boot.oat",
            offset: 0x36a1f4,
            method_name: "java.util.concurrent.ThreadPoolExecutor.runWorker",
            in_app: false,
          },
          {
            frame_index: 14,
            binary_name: "boot.oat",
            offset: 0x36b0d8,
            method_name: "java.util.concurrent.ThreadPoolExecutor$Worker.run",
            in_app: false,
          },
          {
            frame_index: 15,
            binary_name: "base.odex",
            offset: 0x4f2c10,
            method_name:
              "com.bumptech.glide.load.engine.executor.GlideExecutor$DefaultThreadFactory$1.run",
            in_app: false,
          },
          {
            frame_index: 16,
            binary_name: "boot.oat",
            offset: 0x1d5e64,
            method_name: "java.lang.Thread.run",
            in_app: false,
          },
          {
            frame_index: 17,
            binary_name: "libart.so",
            offset: 0x218be8,
            method_name: "art_quick_invoke_stub",
            in_app: false,
          },
          {
            frame_index: 18,
            binary_name: "libart.so",
            offset: 0x2a3f1c,
            method_name:
              "art::ArtMethod::Invoke(art::Thread*, unsigned int*, unsigned int, art::JValue*, char const*)",
            in_app: false,
          },
          {
            frame_index: 19,
            binary_name: "libart.so",
            offset: 0x5d81a4,
            method_name: "art::Thread::CreateCallback(void*)",
            in_app: false,
          },
          {
            frame_index: 20,
            binary_name: "libc.so",
            offset: 0xc89b4,
            method_name: "__pthread_start(void*)",
            in_app: false,
          },
          {
            frame_index: 21,
            binary_name: "libc.so",
            offset: 0x5ed50,
            method_name: "__start_thread",
            in_app: false,
          },
        ],
      },
    ],
    threads: [
      {
        name: "main",
        frames: [
          {
            frame_index: 0,
            binary_name: "libc.so",
            offset: 0xa3f8c,
            method_name: "__epoll_pwait",
            in_app: false,
          },
          {
            frame_index: 1,
            binary_name: "libutils.so",
            offset: 0x1691c,
            method_name: "android::Looper::pollInner(int)",
            in_app: false,
          },
          {
            frame_index: 2,
            binary_name: "libutils.so",
            offset: 0x16524,
            method_name: "android::Looper::pollOnce(int, int*, int*, void**)",
            in_app: false,
          },
          {
            frame_index: 3,
            binary_name: "libandroid_runtime.so",
            offset: 0x14ae0c,
            method_name:
              "android::android_os_MessageQueue_nativePollOnce(_JNIEnv*, _jobject*, long, int)",
            in_app: false,
          },
          {
            frame_index: 4,
            binary_name: "boot-framework.oat",
            offset: 0x19c22c,
            method_name: "art_jni_trampoline",
            in_app: false,
          },
          {
            frame_index: 5,
            binary_name: "boot-framework.oat",
            offset: 0x5d2f40,
            method_name: "android.os.MessageQueue.next",
            in_app: false,
          },
          {
            frame_index: 6,
            binary_name: "boot-framework.oat",
            offset: 0x5b9e14,
            method_name: "android.os.Looper.loopOnce",
            in_app: false,
          },
          {
            frame_index: 7,
            binary_name: "boot-framework.oat",
            offset: 0x5ba6c8,
            method_name: "android.os.Looper.loop",
            in_app: false,
          },
          {
            frame_index: 8,
            binary_name: "boot-framework.oat",
            offset: 0x3e8d50,
            method_name: "android.app.ActivityThread.main",
            in_app: false,
          },
        ],
      },
      {
        name: "RenderThread",
        frames: [
          {
            frame_index: 0,
            binary_name: "libc.so",
            offset: 0x5a4b8,
            method_name: "syscall",
            in_app: false,
          },
          {
            frame_index: 1,
            binary_name: "libhwui.so",
            offset: 0x2b7f40,
            method_name:
              "android::uirenderer::renderthread::RenderThread::threadLoop()",
            in_app: false,
          },
          {
            frame_index: 2,
            binary_name: "libutils.so",
            offset: 0x11b0c,
            method_name: "android::Thread::_threadLoop(void*)",
            in_app: false,
          },
          {
            frame_index: 3,
            binary_name: "libc.so",
            offset: 0xc89b4,
            method_name: "__pthread_start(void*)",
            in_app: false,
          },
          {
            frame_index: 4,
            binary_name: "libc.so",
            offset: 0x5ed50,
            method_name: "__start_thread",
            in_app: false,
          },
        ],
      },
      {
        name: "glide-source-thread-2",
        frames: [
          {
            frame_index: 0,
            binary_name: "libc.so",
            offset: 0x5a4b8,
            method_name: "syscall",
            in_app: false,
          },
          {
            frame_index: 1,
            binary_name: "libart.so",
            offset: 0x2f6c1c,
            method_name:
              "art::ConditionVariable::WaitHoldingLocks(art::Thread*)",
            in_app: false,
          },
          {
            frame_index: 2,
            binary_name: "boot.oat",
            offset: 0x2c8e74,
            method_name: "java.lang.Object.wait",
            in_app: false,
          },
          {
            frame_index: 3,
            binary_name: "boot.oat",
            offset: 0x4a1c28,
            method_name: "java.util.concurrent.locks.LockSupport.park",
            in_app: false,
          },
          {
            frame_index: 4,
            binary_name: "boot.oat",
            offset: 0x36f3a0,
            method_name: "java.util.concurrent.LinkedBlockingQueue.take",
            in_app: false,
          },
          {
            frame_index: 5,
            binary_name: "boot.oat",
            offset: 0x36a0b8,
            method_name: "java.util.concurrent.ThreadPoolExecutor.getTask",
            in_app: false,
          },
          {
            frame_index: 6,
            binary_name: "boot.oat",
            offset: 0x36a1f4,
            method_name: "java.util.concurrent.ThreadPoolExecutor.runWorker",
            in_app: false,
          },
          {
            frame_index: 7,
            binary_name: "boot.oat",
            offset: 0x1d5e64,
            method_name: "java.lang.Thread.run",
            in_app: false,
          },
          {
            frame_index: 8,
            binary_name: "libc.so",
            offset: 0xc89b4,
            method_name: "__pthread_start(void*)",
            in_app: false,
          },
          {
            frame_index: 9,
            binary_name: "libc.so",
            offset: 0x5ed50,
            method_name: "__start_thread",
            in_app: false,
          },
        ],
      },
      {
        name: "OkHttp Dispatcher",
        frames: [
          {
            frame_index: 0,
            binary_name: "libc.so",
            offset: 0x5a4b8,
            method_name: "syscall",
            in_app: false,
          },
          {
            frame_index: 1,
            binary_name: "libart.so",
            offset: 0x2f6c1c,
            method_name:
              "art::ConditionVariable::WaitHoldingLocks(art::Thread*)",
            in_app: false,
          },
          {
            frame_index: 2,
            binary_name: "boot.oat",
            offset: 0x2c8e74,
            method_name: "java.lang.Object.wait",
            in_app: false,
          },
          {
            frame_index: 3,
            binary_name: "boot.oat",
            offset: 0x4a1c28,
            method_name: "java.util.concurrent.locks.LockSupport.park",
            in_app: false,
          },
          {
            frame_index: 4,
            binary_name: "boot.oat",
            offset: 0x36f3a0,
            method_name: "java.util.concurrent.LinkedBlockingQueue.take",
            in_app: false,
          },
          {
            frame_index: 5,
            binary_name: "boot.oat",
            offset: 0x36a0b8,
            method_name: "java.util.concurrent.ThreadPoolExecutor.getTask",
            in_app: false,
          },
          {
            frame_index: 6,
            binary_name: "boot.oat",
            offset: 0x36a1f4,
            method_name: "java.util.concurrent.ThreadPoolExecutor.runWorker",
            in_app: false,
          },
          {
            frame_index: 7,
            binary_name: "boot.oat",
            offset: 0x1d5e64,
            method_name: "java.lang.Thread.run",
            in_app: false,
          },
          {
            frame_index: 8,
            binary_name: "libc.so",
            offset: 0xc89b4,
            method_name: "__pthread_start(void*)",
            in_app: false,
          },
          {
            frame_index: 9,
            binary_name: "libc.so",
            offset: 0x5ed50,
            method_name: "__start_thread",
            in_app: false,
          },
        ],
      },
    ],
    file_name: "blur_filter.cpp",
    method_name:
      "acme::BlurFilter::blurRow(unsigned char const*, unsigned char*, int)",
    line_number: 88,
    stacktrace: `#00 pc 0x000000000001e2c8  libacme_imaging.so (acme::BlurFilter::blurRow(unsigned char const*, unsigned char*, int)) (blur_filter.cpp:88)
#01 pc 0x000000000001e0f4  libacme_imaging.so (acme::BlurFilter::apply(acme::Bitmap&, int)) (blur_filter.cpp:41)
#02 pc 0x000000000001b9a0  libacme_imaging.so (Java_com_acme_shop_imaging_NativeBlur_nativeApply) (native_blur.cpp:27)
    ... 4 internal frames ...
#07 pc 0x000000000052c6e8  base.odex (com.acme.shop.imaging.NativeBlur.apply)
#08 pc 0x000000000052c41c  base.odex (com.acme.shop.imaging.HeroBlurTransformation.transform)
#09 pc 0x00000000004e81c4  base.odex (com.bumptech.glide.load.resource.bitmap.BitmapTransformation.transform)
#10 pc 0x00000000004d2a58  base.odex (com.bumptech.glide.load.engine.DecodeJob.transformEncodeAndTranscode)
#11 pc 0x00000000004d1f9c  base.odex (com.bumptech.glide.load.engine.DecodeJob.decodeFromRetrievedData)
#12 pc 0x00000000004d0b40  base.odex (com.bumptech.glide.load.engine.DecodeJob.run)
#13 pc 0x000000000036a1f4  boot.oat (java.util.concurrent.ThreadPoolExecutor.runWorker)
#14 pc 0x000000000036b0d8  boot.oat (java.util.concurrent.ThreadPoolExecutor$Worker.run)
#15 pc 0x00000000004f2c10  base.odex (com.bumptech.glide.load.engine.executor.GlideExecutor$DefaultThreadFactory$1.run)
#16 pc 0x00000000001d5e64  boot.oat (java.lang.Thread.run)
    ... 3 internal frames ...
#20 pc 0x00000000000c89b4  libc.so (__pthread_start(void*))
#21 pc 0x000000000005ed50  libc.so (__start_thread)`,
  },
];

export const androidNativeScenario: PlatformScenario = {
  ids: { product: "slug", orderPrefix: "ord-" },
  app: {
    id: stableUuid("app:acme-native-android"),
    name: "Acme - Native Android",
    os: "android",
    framework: "native",
    uniqueId: "com.acme.shop",
    sdkVersion: "0.20.0",
    versions: [
      { name: "3.2.1", code: "3210", releasedDaysAgo: 11 },
      { name: "3.2.0", code: "3200", releasedDaysAgo: 34 },
      { name: "3.1.4", code: "3140", releasedDaysAgo: 266 },
    ],
    candidate: { name: "3.2.2", code: "3220" },
    mappingTypes: ["proguard", "elf_debug"],
    createdDaysAgo: 260,
    dailySessions: 420_000,
    crashFreeRate: 0.99183,
    anrFreeRate: 0.99672,
    perceivedCrashFreeRate: 0.99614,
  },

  ui: {
    style: "android",
    screens: {
      home: "home",
      product_list: "products",
      product_detail: "product_detail",
      search: "search",
      cart: "cart",
      checkout: "checkout",
      payment: "payment",
      order_confirmation: "order_confirmation",
      orders: "orders",
      profile: "profile",
      login: "login",
    },
  },
  screens: [
    {
      key: "home",
      label: "Home",
      className: "com.acme.shop.home.HomeActivity",
      lifecycle: "activity",
    },
    {
      key: "product_list",
      label: "Product List",
      className: "com.acme.shop.catalog.ProductListActivity",
      lifecycle: "activity",
    },
    {
      key: "product_detail",
      label: "Product Detail",
      className: "com.acme.shop.catalog.ProductDetailFragment",
      lifecycle: "fragment",
      parentActivity: "com.acme.shop.catalog.ProductListActivity",
    },
    {
      key: "search",
      label: "Search",
      className: "com.acme.shop.search.SearchActivity",
      lifecycle: "activity",
    },
    {
      key: "cart",
      label: "Cart",
      className: "com.acme.shop.cart.CartFragment",
      lifecycle: "fragment",
      parentActivity: "com.acme.shop.home.HomeActivity",
    },
    {
      key: "checkout",
      label: "Checkout",
      className: "com.acme.shop.checkout.CheckoutActivity",
      lifecycle: "activity",
    },
    {
      key: "payment",
      label: "Payment",
      className: "com.acme.shop.payment.PaymentFragment",
      lifecycle: "fragment",
      parentActivity: "com.acme.shop.checkout.CheckoutActivity",
    },
    {
      key: "order_confirmation",
      label: "Order Confirmation",
      className: "com.acme.shop.order.OrderConfirmationActivity",
      lifecycle: "activity",
    },
    {
      key: "orders",
      label: "Orders",
      className: "com.acme.shop.order.OrderHistoryActivity",
      lifecycle: "activity",
    },
    {
      key: "profile",
      label: "Profile",
      className: "com.acme.shop.profile.ProfileActivity",
      lifecycle: "activity",
    },
    {
      key: "login",
      label: "Login",
      className: "com.acme.shop.auth.LoginActivity",
      lifecycle: "activity",
    },
  ],

  devices: [
    {
      device_name: "husky",
      device_model: "Pixel 8 Pro",
      device_manufacturer: "Google",
      device_type: "phone",
      os_version: "35",
      device_width_px: 1344,
      device_height_px: 2992,
      device_density_dpi: 480,
      device_density: 3.0,
      device_cpu_arch: "",
      device_is_foldable: false,
      device_low_power_mode: false,
      device_thermal_throttling_enabled: false,
      os_page_size: 4,
      network_type: "wifi",
      network_generation: "unknown",
      network_provider: "Verizon",
    },
    {
      device_name: "panther",
      device_model: "Pixel 7",
      device_manufacturer: "Google",
      device_type: "phone",
      os_version: "34",
      device_width_px: 1080,
      device_height_px: 2400,
      device_density_dpi: 420,
      device_density: 2.625,
      device_cpu_arch: "",
      device_is_foldable: false,
      device_low_power_mode: false,
      device_thermal_throttling_enabled: false,
      os_page_size: 4,
      network_type: "cellular",
      network_generation: "5g",
      network_provider: "Verizon",
    },
    {
      device_name: "dm1q",
      device_model: "SM-S911B",
      device_manufacturer: "samsung",
      device_type: "phone",
      os_version: "35",
      device_width_px: 1080,
      device_height_px: 2340,
      device_density_dpi: 450,
      device_density: 2.8125,
      device_cpu_arch: "",
      device_is_foldable: false,
      device_low_power_mode: false,
      device_thermal_throttling_enabled: false,
      os_page_size: 4,
      network_type: "wifi",
      network_generation: "unknown",
      network_provider: "AT&T",
    },
    {
      device_name: "r9q",
      device_model: "SM-G990B",
      device_manufacturer: "samsung",
      device_type: "phone",
      os_version: "34",
      device_width_px: 1080,
      device_height_px: 2400,
      device_density_dpi: 420,
      device_density: 2.625,
      device_cpu_arch: "",
      device_is_foldable: false,
      device_low_power_mode: true,
      device_thermal_throttling_enabled: false,
      os_page_size: 4,
      network_type: "cellular",
      network_generation: "4g",
      network_provider: "T-Mobile",
    },
    {
      device_name: "salami",
      device_model: "CPH2449",
      device_manufacturer: "OnePlus",
      device_type: "phone",
      os_version: "35",
      device_width_px: 1440,
      device_height_px: 3216,
      device_density_dpi: 560,
      device_density: 3.5,
      device_cpu_arch: "",
      device_is_foldable: false,
      device_low_power_mode: false,
      device_thermal_throttling_enabled: true,
      os_page_size: 4,
      network_type: "cellular",
      network_generation: "5g",
      network_provider: "T-Mobile",
    },
    {
      device_name: "a14",
      device_model: "SM-A145F",
      device_manufacturer: "samsung",
      device_type: "phone",
      os_version: "34",
      device_width_px: 1080,
      device_height_px: 2408,
      device_density_dpi: 400,
      device_density: 2.5,
      device_cpu_arch: "",
      device_is_foldable: false,
      device_low_power_mode: false,
      device_thermal_throttling_enabled: false,
      os_page_size: 4,
      network_type: "cellular",
      network_generation: "4g",
      network_provider: "T-Mobile",
    },
  ],

  users: [
    { person: 0, device: 0, locale: "en-US" },
    { person: 1, device: 1, locale: "en-US" },
    { person: 2, device: 2, locale: "en-US" },
    { person: 3, device: 3, locale: "en-US" },
    { person: 4, device: 4, locale: "en-US" },
    { person: 5, device: 5, locale: "en-US" },
  ],

  http: [
    {
      key: "get_products",
      url: "https://api.acme.shop/v1/products",
      method: "get",
      client: "okhttp",
      statusCodes: [
        { code: 200, weight: 0.97 },
        { code: 500, weight: 0.03 },
      ],
      latencyMs: [80, 240],
      responseBody: '{"products":{catalog}}',
    },
    {
      key: "get_product_detail",
      url: "https://api.acme.shop/v1/products/{product_id}",
      method: "get",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 1 }],
      latencyMs: [60, 180],
      responseBody:
        '{"id":"{product_id}","name":"{product_name}","price":{price},"currency":"USD","in_stock":true}',
    },
    {
      key: "get_product_reviews",
      url: "https://api.acme.shop/v1/products/{product_id}/reviews?page_size=20",
      method: "get",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 1 }],
      latencyMs: [70, 220],
    },
    {
      key: "get_cdn_hero_image",
      url: "https://cdn.acme.shop/images/{product_id}/hero.webp",
      method: "get",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 1 }],
      latencyMs: [150, 900],
    },
    {
      key: "search_products",
      url: "https://api.acme.shop/v1/search?q={query_param}",
      method: "get",
      client: "okhttp",
      statusCodes: [
        { code: 200, weight: 0.95 },
        { code: 504, weight: 0.05 },
      ],
      latencyMs: [100, 320],
      responseBody:
        '{"query":"{query}","total":{result_count},"results":{results}}',
      effect: "search",
    },
    {
      key: "post_cart",
      url: "https://api.acme.shop/v1/cart/items",
      method: "post",
      client: "okhttp",
      statusCodes: [
        { code: 201, weight: 0.96 },
        { code: 409, weight: 0.04 },
      ],
      latencyMs: [90, 260],
      requestBody:
        '{"product_id":"{product_id}","option":"{option}","qty":{quantity}}',
      responseBody: '{"cart_id":"{cart_id}","items":{item_count}}',
      effect: "cart_add",
    },
    {
      key: "patch_cart_item",
      url: "https://api.acme.shop/v1/cart/items/{product_id}",
      method: "patch",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 1 }],
      latencyMs: [80, 220],
      requestBody: '{"qty":{quantity}}',
      responseBody: '{"cart_id":"{cart_id}","items":{item_count}}',
      effect: "cart_update",
    },
    {
      key: "delete_cart_item",
      url: "https://api.acme.shop/v1/cart/items/{product_id}",
      method: "delete",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 1 }],
      latencyMs: [80, 220],
      responseBody: '{"cart_id":"{cart_id}","items":{item_count}}',
      effect: "cart_remove",
    },
    {
      key: "get_cart",
      url: "https://api.acme.shop/v1/cart",
      method: "get",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 1 }],
      latencyMs: [50, 160],
      responseBody:
        '{"cart_id":"{cart_id}","items":{cart_items},"total":{total}}',
    },
    {
      key: "post_promo",
      url: "https://api.acme.shop/v1/promotions/validate",
      method: "post",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 0.97 }],
      latencyMs: [90, 280],
      requestBody: '{"code":"{coupon}","cart_id":"{cart_id}"}',
      responseBody: '{"code":"{coupon}","valid":true,"discount":{discount}}',
      effect: "coupon",
      failure: {
        reason: "java.net.SocketTimeoutException",
        description: "timeout",
        weight: 0.03,
        durationMs: [10_000, 10_040],
      },
    },
    {
      key: "post_checkout",
      url: "https://api.acme.shop/v1/checkout",
      method: "post",
      client: "okhttp",
      statusCodes: [
        { code: 200, weight: 0.9 },
        { code: 503, weight: 0.1 },
      ],
      latencyMs: [200, 650],
      requestBody:
        '{"cart_id":"{cart_id}","items":{cart_items},"coupon":"{coupon}"}',
      responseBody: '{"cart_id":"{cart_id}","valid":true,"total":{total}}',
    },
    {
      key: "post_payment",
      url: "https://api.acme.shop/v1/payment",
      method: "post",
      client: "okhttp",
      statusCodes: [
        { code: 200, weight: 0.92 },
        { code: 402, weight: 0.08 },
      ],
      latencyMs: [180, 520],
      requestBody:
        '{"method":"{payment_method}","amount":{total},"currency":"USD"}',
      responseBody: '{"status":"authorized","amount":{total}}',
    },
    {
      key: "post_order",
      url: "https://api.acme.shop/v1/orders",
      method: "post",
      client: "okhttp",
      statusCodes: [{ code: 201, weight: 1 }],
      latencyMs: [250, 700],
      requestBody: '{"cart_id":"{cart_id}","shipping":"{shipping_method}"}',
      responseBody:
        '{"order_id":"{order_id}","number":"{order_number}","status":"confirmed"}',
      effect: "order",
    },
    {
      key: "get_order_confirm",
      url: "https://api.acme.shop/v1/orders/{order_id}",
      method: "get",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 1 }],
      latencyMs: [60, 180],
      responseBody:
        '{"order_id":"{order_id}","status":"confirmed","total":{total}}',
    },
    {
      key: "get_orders",
      url: "https://api.acme.shop/v1/orders",
      method: "get",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 1 }],
      latencyMs: [70, 220],
    },
    {
      key: "post_login",
      url: "https://api.acme.shop/v1/auth/login",
      method: "post",
      client: "okhttp",
      statusCodes: [
        { code: 200, weight: 0.95 },
        { code: 401, weight: 0.05 },
      ],
      latencyMs: [120, 300],
      requestBody: '{"email":"{email}"}',
      responseBody: '{"user_id":"{user_id}","token":"***"}',
    },
    {
      key: "get_profile",
      url: "https://api.acme.shop/v1/profile",
      method: "get",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 1 }],
      latencyMs: [70, 200],
      responseBody:
        '{"user_id":"{user_id}","first_name":"{first_name}","last_name":"{last_name}","email":"{email}"}',
    },
    {
      key: "patch_preferences",
      url: "https://api.acme.shop/v1/profile/preferences",
      method: "patch",
      client: "okhttp",
      statusCodes: [{ code: 200, weight: 1 }],
      latencyMs: [70, 200],
      requestBody: '{"promotions":true}',
    },
  ],

  exceptions: androidExceptions,

  spans: shopSpans({
    worker: "DefaultDispatcher-worker-2",
    network: "network",
    decode: "glide-source-thread-1",
    launch: {
      atSessionStart: true,
      sessionStore: "encrypted_shared_preferences",
      database: "room",
      initThreads: {
        auth: "DefaultDispatcher-worker-1",
        cart: "DefaultDispatcher-worker-2",
        flags: "DefaultDispatcher-worker-3",
      },
    },
    requests: {
      feed: "get_products",
      detail: "get_product_detail",
      reviews: "get_product_reviews",
      image: "get_cdn_hero_image",
      search: "search_products",
      cart: "get_cart",
      validate: "post_checkout",
      payment: "post_payment",
      order: "post_order",
    },
    image: { format: "webp", width: "1080" },
    layout: { view_count: "84" },
  }),

  flows: standardFlows(
    {
      screen: {
        login: "login",
        home: "home",
        products: "product_list",
        search: "search",
        product_detail: "product_detail",
        cart: "cart",
        checkout: "checkout",
        payment: "payment",
        order_confirmation: "order_confirmation",
        profile: "profile",
        orders: "orders",
      },
      http: {
        products: "get_products",
        cart_add: "post_cart",
        cart_update: "patch_cart_item",
        cart_remove: "delete_cart_item",
        promo: "post_promo",
        order_confirm: "get_order_confirm",
        orders: "get_orders",
        login: "post_login",
        profile: "get_profile",
        preferences: "patch_preferences",
      },
      span: {
        app_launch: "app_launch",
        app_launch_signed_out: "app_launch_signed_out",
        product_load: "product_load",
        checkout_flow: "checkout_flow",
        search_query: "search_query",
        cart_refresh: "cart_refresh",
      },
      wallet: "radio_google_pay",
    },
    {
      checkoutCrash: {
        abortBefore: SPAN_STEPS.createOrder,
        steps: [{ kind: "exception", exception: "npe_checkout" }],
      },
      listCrash: [
        { kind: "exception", exception: "illegalstate_recyclerview" },
      ],
      detailAnr: [{ kind: "exception", exception: "anr_image_decode" }],
      detailCrash: {
        abortBefore: SPAN_STEPS.productDecode,
        steps: [{ kind: "exception", exception: "gwp_asan_uaf_hero_blur" }],
      },
      cartHandled: {
        coupon: {
          code: "SPRING20",
          failure: [
            { kind: "exception", exception: "timeout_cart_handled" },
            {
              kind: "log",
              severity: "warning",
              body: "Promo code validation timed out, checking out without the code",
            },
          ],
        },
      },
      reports: {
        orders: (j) =>
          j.bugReport(
            "Order ACM-47902 still says Out for delivery. The carrier emailed me on Saturday that it was delivered, but the app never updated.",
          ),
        cart: (j) =>
          j
            .removeLine(1)
            .tap("field_coupon")
            .type("SPRING20")
            .tap("field_coupon")
            .type("")
            .bugReport(
              "I typed SPRING20 into the coupon box and when the keyboard closed the box was empty again. No error, the code just disappears.",
            ),
      },
      keys: {
        search: "search_flow",
        purchase: "checkout_success",
        checkout_crash: "checkout_crash",
        list_crash: "product_list_crash",
        detail_anr: "product_detail_anr",
        detail_crash: "product_detail_native_crash",
        cart_handled: "cart_timeout_handled",
        login: "login_flow",
        profile: "profile_flow",
        cart_bug: "bug_report_flow",
      },
    },
  ),

  sessions: [
    {
      flow: "checkout_success",
      user: 0,
      version: 0,
      agoMinutes: 20,
      launch: "cold",
    },
    {
      flow: "search_flow",
      user: 1,
      version: 0,
      agoMinutes: 55,
      launch: "warm",
      memoryLeak: true,
    },
    {
      flow: "bug_report_flow",
      user: 3,
      version: 0,
      agoMinutes: 90,
      launch: "hot",
    },
    {
      flow: "checkout_crash",
      user: 2,
      version: 0,
      agoMinutes: 12,
      launch: "cold",
    },
    {
      flow: "checkout_crash",
      user: 3,
      version: 2,
      agoMinutes: 20000,
      launch: "warm",
    },
    {
      flow: "product_list_crash",
      user: 4,
      version: 0,
      agoMinutes: 160,
      launch: "cold",
    },
    {
      flow: "product_detail_anr",
      user: 4,
      version: 1,
      agoMinutes: 245,
      launch: "warm",
    },
    {
      flow: "cart_timeout_handled",
      user: 0,
      version: 1,
      agoMinutes: 260,
      launch: "cold",
    },
    {
      flow: "login_flow",
      user: 2,
      version: 1,
      agoMinutes: 275,
      launch: "cold",
      memoryLeak: true,
    },
    {
      flow: "product_detail_native_crash",
      user: 5,
      version: 1,
      agoMinutes: 200,
      launch: "cold",
    },
  ],

  launch: {
    coldMs: [300, 900],
    warmMs: [120, 400],
    hotMs: [40, 150],
  },

  threadNames: { main: "main", network: "OkHttp Dispatcher" },
};
