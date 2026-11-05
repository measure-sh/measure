import { DateTime } from "luxon";

const demoLastEventTime = DateTime.now().toUTC();
export const demoSession = {
  app_id: "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
  attribute: {
    installation_id: "1fefa265-9e6b-45d8-aa83-23b03070c06e",
    app_version: "2.0.0",
    app_build: "200",
    app_unique_id: "sh.measure.demo",
    measure_sdk_version: "1.0.0",
    platform: "android",
    thread_name: "msr-default",
    user_id: "demo-user-id",
    device_name: "sunfish",
    device_model: "Pixel 7 Pro",
    device_manufacturer: "Google",
    device_type: "phone",
    device_is_foldable: false,
    device_is_physical: true,
    device_density_dpi: 440,
    device_width_px: 1080,
    device_height_px: 2138,
    device_density: 2.75,
    device_locale: "en-US",
    device_low_power_mode: false,
    device_thermal_throttling_enabled: false,
    device_cpu_arch: "",
    os_name: "android",
    os_version: "33",
    os_page_size: 0,
    network_type: "Wifi",
    network_provider: "unknown",
    network_generation: "unknown",
  },
  cpu_usage: [
    {
      timestamp: demoLastEventTime.minus({ minutes: 7.5 }).toISO(),
      value: 5,
    },
    {
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 3 })
        .toISO(),
      value: 15.625,
    },
    {
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 6 })
        .toISO(),
      value: 12.314,
    },
    {
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 9 })
        .toISO(),
      value: 35.742,
    },
    {
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 12 })
        .toISO(),
      value: 38.923,
    },
  ],
  duration: 13000,
  memory_usage: [
    {
      java_max_heap: 262144,
      java_total_heap: 262144,
      java_free_heap: 259685,
      total_pss: 10846,
      rss: 105040,
      anon_rss: 49152,
      swap: 0,
      dynamic_memory: 49152,
      native_total_heap: 12612,
      native_free_heap: 1170,
      interval: 0,
      timestamp: demoLastEventTime.minus({ minutes: 7.5 }).toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 58687,
      total_pss: 57496,
      rss: 135104,
      anon_rss: 61440,
      swap: 4096,
      dynamic_memory: 65536,
      native_total_heap: 17752,
      native_free_heap: 1259,
      interval: 2056,
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 3 })
        .toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 58391,
      total_pss: 57572,
      rss: 135240,
      anon_rss: 65536,
      swap: 8192,
      dynamic_memory: 73728,
      native_total_heap: 17752,
      native_free_heap: 1229,
      interval: 2043,
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 6 })
        .toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 57931,
      total_pss: 59015,
      rss: 136396,
      anon_rss: 67584,
      swap: 8192,
      dynamic_memory: 75776,
      native_total_heap: 18520,
      native_free_heap: 1314,
      interval: 2055,
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 9 })
        .toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 57162,
      total_pss: 59904,
      rss: 137996,
      anon_rss: 69632,
      swap: 10240,
      dynamic_memory: 79872,
      native_total_heap: 19544,
      native_free_heap: 1307,
      interval: 2032,
      timestamp: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 12 })
        .toISO(),
    },
  ],
  memory_usage_absolute: null,
  session_id: "81f06f23-4291-4590-a5df-c96d57d3c692",
  threads: {
    main: [
      {
        event_type: "cold_launch",
        user_defined_attribute: null,
        thread_name: "main",
        duration: 785,
        timestamp: demoLastEventTime.minus({ minutes: 7.5 }).toISO(),
        attachments: [
          {
            id: "6c566550-19be-43e8-978f-affb560f9bb6",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_splash",
            location: "/snapshots/demo_snapshot_splash.json",
          },
        ],
      },
      {
        event_type: "lifecycle_app",
        user_defined_attribute: null,
        thread_name: "main",
        type: "foreground",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 43 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "resumed",
        class_name: "sh.measure.demo.MainActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 91 })
          .toISO(),
      },
      {
        event_type: "screen_view",
        user_defined_attribute: null,
        thread_name: "main",
        user_triggered: false,
        name: "Home",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 120 })
          .toISO(),
      },
      {
        event_type: "string",
        user_defined_attribute: null,
        thread_name: "main",
        severity_text: "debug",
        string: "Rendered product grid (24 items)",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 960 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.card.MaterialCardView",
        target_id: "card_product_1",
        label: "Runner Sneakers",
        semantic_label: "Runner Sneakers",
        width: 125,
        height: 200,
        x: 102,
        y: 428,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 1600 })
          .toISO(),
        attachments: [
          {
            id: "125df6e5-1e45-4380-bcc6-8c13e50439f8",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_home_click",
            location: "/snapshots/demo_snapshot_home_click.json",
          },
        ],
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "paused",
        class_name: "sh.measure.demo.MainActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 1740 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "resumed",
        class_name: "sh.measure.demo.ProductDetailActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 1755 })
          .toISO(),
      },
      {
        event_type: "screen_view",
        user_defined_attribute: null,
        thread_name: "main",
        user_triggered: false,
        name: "ProductDetail",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 1780 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_size_l",
        label: "Size L",
        semantic_label: "Size L",
        width: 52,
        height: 48,
        x: 170,
        y: 530,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 2700 })
          .toISO(),
        attachments: [
          {
            id: "3c9a1f47-52d0-4a8b-9f61-2d7e4c05b8a3",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_size_click",
            location: "/snapshots/demo_snapshot_size_click.json",
          },
        ],
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_add_to_cart",
        label: "Add to cart",
        semantic_label: "Add to cart",
        width: 125,
        height: 200,
        x: 196,
        y: 716,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 3400 })
          .toISO(),
        attachments: [
          {
            id: "2b7c9e14-5a83-4d61-8f0c-9e3a1d47b25f",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_add_to_cart_click",
            location: "/snapshots/demo_snapshot_add_to_cart_click.json",
          },
        ],
      },
      {
        event_type: "string",
        user_defined_attribute: null,
        thread_name: "main",
        severity_text: "info",
        string: "Added runner-sneakers to cart (qty 1)",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 3450 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "paused",
        class_name: "sh.measure.demo.ProductDetailActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 4700 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "resumed",
        class_name: "sh.measure.demo.CartActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 4715 })
          .toISO(),
      },
      {
        event_type: "screen_view",
        user_defined_attribute: null,
        thread_name: "main",
        user_triggered: false,
        name: "Cart",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 4740 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_checkout",
        label: "Proceed to checkout",
        semantic_label: "Proceed to checkout",
        width: 125,
        height: 200,
        x: 196,
        y: 760,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 5600 })
          .toISO(),
        attachments: [
          {
            id: "7d41a0c6-3e92-4b58-a17d-6c05f8e29431",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_cart_click",
            location: "/snapshots/demo_snapshot_cart_click.json",
          },
        ],
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "paused",
        class_name: "sh.measure.demo.CartActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 5740 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "resumed",
        class_name: "sh.measure.demo.CheckoutActivity",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 5755 })
          .toISO(),
      },
      {
        event_type: "screen_view",
        user_defined_attribute: null,
        thread_name: "main",
        user_triggered: false,
        name: "Checkout",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 5780 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_discount_1",
        label: "Apply discount",
        semantic_label: "Apply discount",
        width: 125,
        height: 200,
        x: 70,
        y: 252,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 6000 })
          .toISO(),
        attachments: [
          {
            id: "9e206b3f-8c47-4a15-b0d9-42f7e5c81a6d",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_discount_click",
            location: "/snapshots/demo_snapshot_discount_click.json",
          },
        ],
      },
      {
        event_type: "custom",
        user_defined_attribute: { reward: "$0 off" },
        thread_name: "main",
        user_triggered: true,
        name: "Reward Applied",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 6400 })
          .toISO(),
      },
      {
        event_type: "trim_memory",
        user_defined_attribute: null,
        thread_name: "main",
        level: "TRIM_MEMORY_RUNNING_LOW",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 7800 })
          .toISO(),
      },
      {
        event_type: "screen_view",
        user_defined_attribute: null,
        thread_name: "main",
        user_triggered: false,
        name: "Payment",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 8940 })
          .toISO(),
      },
      {
        event_type: "custom",
        user_defined_attribute: {
          payment_methods:
            '{"payment_methods":[{"name": "personal", "type":"credit_card", "currency": "GBP", "balance": 1000}]}',
        },
        thread_name: "main",
        user_triggered: true,
        name: "Payment Methods Fetched",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 9400 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_pay",
        label: "Pay now",
        semantic_label: "Pay now",
        width: 125,
        height: 200,
        x: 196,
        y: 760,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 9600 })
          .toISO(),
        attachments: [
          {
            id: "4f8d3125-6b07-49ea-9c73-1a5e0b28df94",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_pay_click",
            location: "/snapshots/demo_snapshot_pay_click.json",
          },
        ],
      },
      {
        event_type: "string",
        user_defined_attribute: null,
        thread_name: "main",
        severity_text: "warning",
        string: "Payment validation failed: no payment method selected",
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 9850 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_payment_type",
        label: "Payment method",
        semantic_label: "Payment method",
        width: 360,
        height: 68,
        x: 196,
        y: 122,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 11200 })
          .toISO(),
        attachments: [
          {
            id: "8d5b0e93-7c14-4f26-a3d8-61b9f0472ce5",
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: "demo_snapshot_payment_type_click",
            location: "/snapshots/demo_snapshot_payment_type_click.json",
          },
        ],
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_pay",
        label: "Pay now",
        semantic_label: "Pay now",
        width: 645,
        height: 70,
        x: 359,
        y: 1259,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 13000 })
          .toISO(),
        attachments: [
          {
            id: "6f3d1c2a-4b6e-4c1d-9a2f-0e5b7c8d9a1b",
            name: "screenshot.webp",
            type: "screenshot",
            key: "demo_checkout_screenshot",
            location: "/images/demo_checkout_screenshot.webp",
          },
        ],
      },
      {
        event_type: "error",
        severity: "fatal",
        user_defined_attribute: null,
        user_triggered: false,
        group_id: "9b71282275e88a68b38fe69a1bda0ea7",
        type: "java.lang.IllegalStateException",
        message: "Payment method must be specified",
        method_name: "onClick",
        file_name: "CheckoutActivity.kt",
        line_number: 102,
        thread_name: "main",
        handled: false,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ seconds: 13 })
          .toISO(),
        stacktrace:
          "java.lang.IllegalStateException: Payment method must be specified\n\tat MaterialButton.onClick(CheckoutActivity.kt:102)\n\tat android.view.View.performClick(View.java:6294)\n\tat android.view.View$PerformClick.run(View.java:24774)\n\tat android.os.Handler.handleCallback(Handler.java:790)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loop(Looper.java:164)\n\tat android.app.ActivityThread.main(ActivityThread.java:6518)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:438)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)\nCaused by: java.lang.IllegalStateException: This is a new exception\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:438)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)\nCaused by: java.lang.reflect.InvocationTargetException\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:448)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)",
      },
    ],
    okhttp: [
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/products",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 412,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 700 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/products/runner-sneakers",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 238,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 1900 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/cart",
        method: "POST",
        status_code: 201,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 187,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 3520 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/cart",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 205,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 4750 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/rewards",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 557,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 5798 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/inventory/check",
        method: "POST",
        status_code: 503,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 185,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 6398 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://store.demo-provider.com/v1/discounts/apply",
        method: "POST",
        status_code: 200,
        request_body: "",
        response_body: "",
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 176,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 6350 })
          .toISO(),
      },
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://payments.demo-provider.com/demo-user-id/payment-methods",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body:
          '{"payment_methods":[{"name": "personal", "type":"credit_card", "currency": "GBP", "balance": 1000}]}',
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 742,
        timestamp: demoLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 9100 })
          .toISO(),
      },
    ],
  },
  traces: [
    {
      trace_id: "14f94d4e346a4bb36cf7eb06dae727ff",
      trace_name: "MainActivity Time to Full Display",
      thread_name: "main",
      start_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 43 })
        .toISO(),
      end_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 1230 })
        .toISO(),
      duration: 1187,
    },
    {
      trace_id: "a3c7db90d18966d5c40a4a464b63ca69",
      trace_name: "checkout_full_display",
      thread_name: "main",
      start_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 5755 })
        .toISO(),
      end_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 6985 })
        .toISO(),
      duration: 1230,
    },
    {
      trace_id: "2c9ce6a1b0d94f2e8a6d0c3b5e7f9a1c",
      trace_name: "cart.sync",
      thread_name: "main",
      start_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 4750 })
        .toISO(),
      end_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 5060 })
        .toISO(),
      duration: 310,
    },
    {
      trace_id: "8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d",
      trace_name: "checkout.apply_reward",
      thread_name: "main",
      start_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 6350 })
        .toISO(),
      end_time: demoLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 6526 })
        .toISO(),
      duration: 176,
    },
  ],
} as any;
