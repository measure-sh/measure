import type {
  AppSpec,
  DeviceSpec,
  ExceptionSpec,
  FlowSpec,
  HttpSpec,
  PlatformScenario,
  ScreenSpec,
  SessionScript,
  SpanSpec,
} from "../scenario";
import { Journey, SPAN_STEPS, shopSpans, standardFlows } from "../journeys";

const ROUTE_NAMES = [
  "Home",
  "ProductList",
  "ProductDetail",
  "Cart",
  "Checkout",
  "Payment",
  "OrderConfirmation",
  "Orders",
  "Search",
  "Profile",
  "Login",
] as const;

// react-native-screens hosts every route in a view controller named RNSScreen,
// so giving it as className would send every journey edge through one node.
const screens: ScreenSpec[] = ROUTE_NAMES.map((name) => ({
  key: name.toLowerCase(),
  label: name,
  routeName: name,
}));

const androidDevices: DeviceSpec[] = [
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
    network_provider: "Mint Mobile",
  },
  {
    device_name: "dm1q",
    device_model: "SM-S911B",
    device_manufacturer: "samsung",
    device_type: "phone",
    os_version: "34",
    device_width_px: 1080,
    device_height_px: 2340,
    device_density_dpi: 450,
    device_density: 2.8125,
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
    device_name: "tokay",
    device_model: "Pixel 9",
    device_manufacturer: "Google",
    device_type: "phone",
    os_version: "36",
    device_width_px: 1080,
    device_height_px: 2424,
    device_density_dpi: 420,
    device_density: 2.625,
    device_cpu_arch: "",
    device_is_foldable: false,
    device_low_power_mode: false,
    device_thermal_throttling_enabled: false,
    os_page_size: 4,
    network_type: "cellular",
    network_generation: "4g",
    network_provider: "T-Mobile",
  },
];

const iosDevices: DeviceSpec[] = [
  {
    device_name: "iPhone",
    device_model: "iPhone 14 Pro",
    device_manufacturer: "Apple",
    device_type: "phone",
    os_version: "26.2",
    device_width_px: 1179,
    device_height_px: 2556,
    device_density_dpi: 480,
    device_density: 3,
    device_cpu_arch: "arm64e",
    device_is_foldable: false,
    device_low_power_mode: false,
    device_thermal_throttling_enabled: false,
    os_page_size: 0,
    network_type: "wifi",
    network_generation: "5g",
    network_provider: "Verizon",
  },
  {
    device_name: "iPhone",
    device_model: "iPhone 13",
    device_manufacturer: "Apple",
    device_type: "phone",
    os_version: "18.6.2",
    device_width_px: 1170,
    device_height_px: 2532,
    device_density_dpi: 480,
    device_density: 3,
    device_cpu_arch: "arm64e",
    device_is_foldable: false,
    device_low_power_mode: false,
    device_thermal_throttling_enabled: false,
    os_page_size: 0,
    network_type: "cellular",
    network_generation: "5g",
    network_provider: "AT&T",
  },
  {
    device_name: "iPhone",
    device_model: "iPhone SE (3rd generation)",
    device_manufacturer: "Apple",
    device_type: "phone",
    os_version: "18.7.1",
    device_width_px: 750,
    device_height_px: 1334,
    device_density_dpi: 320,
    device_density: 2,
    device_cpu_arch: "arm64e",
    device_is_foldable: false,
    device_low_power_mode: false,
    device_thermal_throttling_enabled: false,
    os_page_size: 0,
    network_type: "cellular",
    network_generation: "4g",
    network_provider: "T-Mobile",
  },
];

function httpSpecsFor(client: string): HttpSpec[] {
  return [
    {
      key: "product_list",
      url: "https://api.acme.shop/v1/products",
      method: "get",
      client,
      statusCodes: [
        { code: 200, weight: 9 },
        { code: 500, weight: 1 },
      ],
      latencyMs: [180, 620],
      responseBody: '{"products":{catalog}}',
    },
    {
      key: "product_detail",
      url: "https://api.acme.shop/v1/products/{product_id}",
      method: "get",
      client,
      statusCodes: [
        { code: 200, weight: 9.8 },
        { code: 404, weight: 0.2 },
      ],
      latencyMs: [140, 520],
      responseBody:
        '{"id":"{product_id}","name":"{product_name}","price":{price_cents},"currency":"USD"}',
    },
    {
      key: "product_reviews",
      url: "https://api.acme.shop/v1/products/{product_id}/reviews",
      method: "get",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [150, 480],
    },
    {
      key: "product_image",
      url: "https://cdn.acme.shop/images/{product_id}/hero.webp",
      method: "get",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [200, 900],
    },
    {
      key: "cart_add",
      url: "https://api.acme.shop/v1/cart/items",
      method: "post",
      client,
      statusCodes: [{ code: 201, weight: 10 }],
      latencyMs: [160, 480],
      requestBody:
        '{"product_id":"{product_id}","option":"{option}","quantity":{quantity}}',
      responseBody: '{"cart_id":"{cart_id}","item_count":{item_count}}',
      effect: "cart_add",
    },
    {
      key: "cart_update",
      url: "https://api.acme.shop/v1/cart/items/{product_id}",
      method: "patch",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [140, 420],
      requestBody: '{"quantity":{quantity}}',
      responseBody: '{"cart_id":"{cart_id}","item_count":{item_count}}',
      effect: "cart_update",
    },
    {
      key: "cart_remove",
      url: "https://api.acme.shop/v1/cart/items/{product_id}",
      method: "delete",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [140, 420],
      responseBody: '{"cart_id":"{cart_id}","item_count":{item_count}}',
      effect: "cart_remove",
    },
    {
      key: "cart_get",
      url: "https://api.acme.shop/v1/cart",
      method: "get",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [110, 380],
      responseBody: '{"cart_id":"{cart_id}","items":{cart_items}}',
    },
    {
      key: "cart_sync",
      url: "https://api.acme.shop/v1/cart/sync",
      method: "post",
      client,
      statusCodes: [{ code: 200, weight: 9 }],
      latencyMs: [300, 900],
      requestBody: '{"cart_id":"{cart_id}","items":{cart_items}}',
      failure: {
        reason: "unknown_host",
        description: 'Unable to resolve host "api.acme.shop"',
        weight: 1,
        durationMs: [40, 250],
      },
    },
    {
      key: "coupon",
      url: "https://api.acme.shop/v1/cart/coupon",
      method: "post",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [160, 480],
      requestBody: '{"code":"{coupon}"}',
      responseBody: '{"code":"{coupon}","discount":{discount}}',
      effect: "coupon",
    },
    {
      key: "checkout_create",
      url: "https://api.acme.shop/v1/checkout",
      method: "post",
      client,
      statusCodes: [{ code: 201, weight: 10 }],
      latencyMs: [320, 900],
      requestBody: '{"cart_id":"{cart_id}","coupon":"{coupon}"}',
      responseBody: '{"cart_id":"{cart_id}","total":{total_cents}}',
    },
    {
      key: "payment_methods",
      url: "https://api.acme.shop/v1/payment-methods",
      method: "get",
      client,
      statusCodes: [
        { code: 200, weight: 9.7 },
        { code: 503, weight: 0.3 },
      ],
      latencyMs: [120, 400],
      responseBody:
        '{"methods":[{"type":"card","brand":"visa","last4":"4242"}]}',
    },
    {
      key: "payment_charge",
      url: "https://api.acme.shop/v1/payments",
      method: "post",
      client,
      statusCodes: [
        { code: 200, weight: 9 },
        { code: 402, weight: 1 },
      ],
      latencyMs: [420, 1250],
      requestBody: '{"method":"{payment_method}","amount":{total_cents}}',
      responseBody: '{"status":"authorized","amount":{total_cents}}',
    },
    {
      key: "order_create",
      url: "https://api.acme.shop/v1/orders",
      method: "post",
      client,
      statusCodes: [{ code: 201, weight: 10 }],
      latencyMs: [300, 850],
      requestBody: '{"cart_id":"{cart_id}","shipping":"{shipping_method}"}',
      responseBody:
        '{"order_id":"{order_id}","number":"{order_number}","status":"confirmed"}',
      effect: "order",
    },
    {
      key: "search",
      url: "https://api.acme.shop/v1/search?q={query_param}",
      method: "get",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [120, 460],
      responseBody: '{"query":"{query}","results":{results}}',
      effect: "search",
    },
    {
      key: "login",
      url: "https://api.acme.shop/v1/auth/login",
      method: "post",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [220, 700],
      requestBody: '{"email":"{email}"}',
      responseBody: '{"user_id":"{user_id}","token":"[redacted]"}',
    },
    {
      key: "profile",
      url: "https://api.acme.shop/v1/profile",
      method: "get",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [100, 360],
      responseBody:
        '{"id":"{user_id}","firstName":"{first_name}","lastName":"{last_name}","email":"{email}"}',
    },
    {
      key: "orders",
      url: "https://api.acme.shop/v1/orders",
      method: "get",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [120, 400],
    },
    {
      key: "preferences",
      url: "https://api.acme.shop/v1/profile/preferences",
      method: "patch",
      client,
      statusCodes: [{ code: 200, weight: 10 }],
      latencyMs: [100, 360],
      requestBody: '{"promotions":true}',
    },
  ];
}

function buildSpans(t: {
  js: string;
  network: string;
  decode: string;
}): SpanSpec[] {
  return shopSpans({
    worker: t.js,
    network: t.network,
    decode: t.decode,
    requests: {
      detail: "product_detail",
      reviews: "product_reviews",
      image: "product_image",
      search: "search",
      cart: "cart_get",
      validate: "checkout_create",
      payment: "payment_charge",
      order: "order_create",
    },
    image: { format: "webp", width: "1080" },
    layout: { view_count: "71" },
  });
}

const androidSpans = buildSpans({
  js: "mqt_js",
  network: "network",
  decode: "FrescoDecodeExecutor-1",
});

const iosSpans = buildSpans({
  js: "com.facebook.react.JavaScript",
  network: "com.apple.NSURLSession-work",
  decode: "com.apple.root.utility-qos",
});

const jsExceptions: ExceptionSpec[] = [
  {
    key: "price_type_error",
    kind: "exception",
    type: "TypeError",
    message: "Cannot read property 'price' of undefined",
    severity: "fatal",
    handled: false,
    foreground: true,
    framework: "js",
    exceptions: [
      {
        type: "TypeError",
        message: "Cannot read property 'price' of undefined",
        thread_sequence: 0,
        frames: [
          {
            frame_index: 0,
            method_name: "getProductPrice",
            file_name: "src/screens/ProductDetailScreen.tsx",
            line_num: 84,
            col_num: 23,
            in_app: true,
          },
          {
            frame_index: 1,
            method_name: "renderProductPrice",
            file_name: "src/screens/ProductDetailScreen.tsx",
            line_num: 132,
            col_num: 31,
            in_app: true,
          },
          {
            frame_index: 2,
            method_name: "ProductDetailScreen",
            file_name: "src/screens/ProductDetailScreen.tsx",
            line_num: 158,
            col_num: 12,
            in_app: true,
          },
          {
            frame_index: 3,
            method_name: "renderWithHooks",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 9284,
            col_num: 29,
            in_app: true,
          },
          {
            frame_index: 4,
            method_name: "updateFunctionComponent",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 11113,
            col_num: 26,
            in_app: true,
          },
          {
            frame_index: 5,
            method_name: "beginWork",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 12629,
            col_num: 20,
            in_app: true,
          },
          {
            frame_index: 6,
            method_name: "performUnitOfWork",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 16324,
            col_num: 16,
            in_app: true,
          },
          {
            frame_index: 7,
            method_name: "workLoopSync",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 16249,
            col_num: 26,
            in_app: true,
          },
          {
            frame_index: 8,
            method_name: "renderRootSync",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 16229,
            col_num: 11,
            in_app: true,
          },
          {
            frame_index: 9,
            method_name: "performSyncWorkOnRoot",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 15927,
            col_num: 21,
            in_app: true,
          },
          {
            frame_index: 10,
            method_name: "flushSyncCallbacks",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 2438,
            col_num: 26,
            in_app: true,
          },
          {
            frame_index: 11,
            method_name: "batchedUpdatesImpl",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 16473,
            col_num: 12,
            in_app: true,
          },
          {
            frame_index: 12,
            method_name: "batchedUpdates",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 1106,
            col_num: 30,
            in_app: true,
          },
          {
            frame_index: 13,
            method_name: "_receiveRootNodeIDEvent",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 1137,
            col_num: 17,
            in_app: true,
          },
          {
            frame_index: 14,
            method_name:
              "ReactNativePrivateInterface.RCTEventEmitter.register$argument_0.receiveTouches",
            file_name:
              "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js",
            line_num: 1209,
            col_num: 30,
            in_app: true,
          },
          {
            frame_index: 15,
            method_name: "__callFunction",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 433,
            col_num: 34,
            in_app: true,
          },
          {
            frame_index: 16,
            method_name: "__guard$argument_0",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 113,
            col_num: 26,
            in_app: true,
          },
          {
            frame_index: 17,
            method_name: "__guard",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 368,
            col_num: 11,
            in_app: true,
          },
          {
            frame_index: 18,
            method_name: "callFunctionReturnFlushedQueue",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 112,
            col_num: 17,
            in_app: true,
          },
        ],
      },
    ],
    threads: [],
    file_name: "src/screens/ProductDetailScreen.tsx",
    method_name: "getProductPrice",
    line_number: 84,
    nativeFollowUp: "js_fatal_native",
    stacktrace: `TypeError: Cannot read property 'price' of undefined
    at getProductPrice (src/screens/ProductDetailScreen.tsx:84:23)
    at renderProductPrice (src/screens/ProductDetailScreen.tsx:132:31)
    at ProductDetailScreen (src/screens/ProductDetailScreen.tsx:158:12)
    at renderWithHooks (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:9284:29)
    at updateFunctionComponent (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:11113:26)
    at beginWork (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:12629:20)
    at performUnitOfWork (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:16324:16)
    at workLoopSync (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:16249:26)
    at renderRootSync (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:16229:11)
    at performSyncWorkOnRoot (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:15927:21)
    at flushSyncCallbacks (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:2438:26)
    at batchedUpdatesImpl (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:16473:12)
    at batchedUpdates (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:1106:30)
    at _receiveRootNodeIDEvent (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:1137:17)
    at ReactNativePrivateInterface.RCTEventEmitter.register$argument_0.receiveTouches (node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js:1209:30)
    at __callFunction (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:433:34)
    at __guard$argument_0 (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:113:26)
    at __guard (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:368:11)
    at callFunctionReturnFlushedQueue (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:112:17)`,
  },
  {
    key: "network_request_failed",
    kind: "exception",
    type: "Error",
    message: "Network request failed",
    severity: "unhandled",
    handled: false,
    foreground: true,
    framework: "js",
    exceptions: [
      {
        type: "Error",
        message: "Network request failed",
        thread_sequence: 0,
        frames: [
          {
            frame_index: 0,
            method_name: "fetchCartTotal",
            file_name: "src/api/cartClient.ts",
            line_num: 47,
            col_num: 15,
            in_app: true,
          },
          {
            frame_index: 1,
            method_name: "apiFetch",
            file_name: "src/api/cartClient.ts",
            line_num: 22,
            col_num: 9,
            in_app: true,
          },
          {
            frame_index: 2,
            method_name: "tryCallOne",
            file_name: "node_modules/promise/setimmediate/core.js",
            line_num: 37,
            col_num: 12,
            in_app: true,
          },
          {
            frame_index: 3,
            method_name: "doResolve$argument_0",
            file_name: "node_modules/promise/setimmediate/core.js",
            line_num: 123,
            col_num: 15,
            in_app: true,
          },
          {
            frame_index: 4,
            method_name: "_callTimer",
            file_name:
              "node_modules/react-native/Libraries/Core/Timers/JSTimers.js",
            line_num: 106,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 5,
            method_name: "_callImmediatesPass",
            file_name:
              "node_modules/react-native/Libraries/Core/Timers/JSTimers.js",
            line_num: 154,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 6,
            method_name: "callImmediates",
            file_name:
              "node_modules/react-native/Libraries/Core/Timers/JSTimers.js",
            line_num: 418,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 7,
            method_name: "__callImmediates",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 411,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 8,
            method_name: "__guard$argument_0",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 187,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 9,
            method_name: "__guard",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 368,
            col_num: 11,
            in_app: true,
          },
          {
            frame_index: 10,
            method_name: "flushedQueue",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 186,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 11,
            method_name: "callFunctionReturnFlushedQueue",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 112,
            col_num: 17,
            in_app: true,
          },
        ],
      },
    ],
    threads: [],
    file_name: "src/api/cartClient.ts",
    method_name: "fetchCartTotal",
    line_number: 47,
    stacktrace: `Error: Network request failed
    at fetchCartTotal (src/api/cartClient.ts:47:15)
    at apiFetch (src/api/cartClient.ts:22:9)
    at tryCallOne (node_modules/promise/setimmediate/core.js:37:12)
    at doResolve$argument_0 (node_modules/promise/setimmediate/core.js:123:15)
    at _callTimer (node_modules/react-native/Libraries/Core/Timers/JSTimers.js:106:6)
    at _callImmediatesPass (node_modules/react-native/Libraries/Core/Timers/JSTimers.js:154:6)
    at callImmediates (node_modules/react-native/Libraries/Core/Timers/JSTimers.js:418:6)
    at __callImmediates (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:411:6)
    at __guard$argument_0 (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:187:6)
    at __guard (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:368:11)
    at flushedQueue (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:186:6)
    at callFunctionReturnFlushedQueue (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:112:17)`,
  },
  {
    key: "payment_method_load_failed",
    kind: "exception",
    type: "Error",
    message: "Failed to load saved payment method",
    severity: "handled",
    handled: true,
    foreground: true,
    framework: "js",
    exceptions: [
      {
        type: "Error",
        message: "Failed to load saved payment method",
        thread_sequence: 0,
        frames: [
          {
            frame_index: 0,
            method_name: "loadSavedPaymentMethod",
            file_name: "src/screens/PaymentScreen.tsx",
            line_num: 58,
            col_num: 19,
            in_app: true,
          },
          {
            frame_index: 1,
            method_name: "PaymentScreen$argument_0",
            file_name: "src/screens/PaymentScreen.tsx",
            line_num: 41,
            col_num: 7,
            in_app: true,
          },
          {
            frame_index: 2,
            method_name: "asyncGeneratorStep",
            file_name:
              "node_modules/@babel/runtime/helpers/asyncToGenerator.js",
            line_num: 3,
            col_num: 24,
            in_app: true,
          },
          {
            frame_index: 3,
            method_name: "_next",
            file_name:
              "node_modules/@babel/runtime/helpers/asyncToGenerator.js",
            line_num: 22,
            col_num: 9,
            in_app: true,
          },
          {
            frame_index: 4,
            method_name: "tryCallOne",
            file_name: "node_modules/promise/setimmediate/core.js",
            line_num: 37,
            col_num: 12,
            in_app: true,
          },
          {
            frame_index: 5,
            method_name: "doResolve$argument_0",
            file_name: "node_modules/promise/setimmediate/core.js",
            line_num: 123,
            col_num: 15,
            in_app: true,
          },
          {
            frame_index: 6,
            method_name: "_callTimer",
            file_name:
              "node_modules/react-native/Libraries/Core/Timers/JSTimers.js",
            line_num: 106,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 7,
            method_name: "_callImmediatesPass",
            file_name:
              "node_modules/react-native/Libraries/Core/Timers/JSTimers.js",
            line_num: 154,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 8,
            method_name: "callImmediates",
            file_name:
              "node_modules/react-native/Libraries/Core/Timers/JSTimers.js",
            line_num: 418,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 9,
            method_name: "__callImmediates",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 411,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 10,
            method_name: "__guard$argument_0",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 187,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 11,
            method_name: "__guard",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 368,
            col_num: 11,
            in_app: true,
          },
          {
            frame_index: 12,
            method_name: "flushedQueue",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 186,
            col_num: 6,
            in_app: true,
          },
          {
            frame_index: 13,
            method_name: "callFunctionReturnFlushedQueue",
            file_name:
              "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            line_num: 112,
            col_num: 17,
            in_app: true,
          },
        ],
      },
    ],
    threads: [],
    file_name: "src/screens/PaymentScreen.tsx",
    method_name: "loadSavedPaymentMethod",
    line_number: 58,
    stacktrace: `Error: Failed to load saved payment method
    at loadSavedPaymentMethod (src/screens/PaymentScreen.tsx:58:19)
    at PaymentScreen$argument_0 (src/screens/PaymentScreen.tsx:41:7)
    at asyncGeneratorStep (node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:24)
    at _next (node_modules/@babel/runtime/helpers/asyncToGenerator.js:22:9)
    at tryCallOne (node_modules/promise/setimmediate/core.js:37:12)
    at doResolve$argument_0 (node_modules/promise/setimmediate/core.js:123:15)
    at _callTimer (node_modules/react-native/Libraries/Core/Timers/JSTimers.js:106:6)
    at _callImmediatesPass (node_modules/react-native/Libraries/Core/Timers/JSTimers.js:154:6)
    at callImmediates (node_modules/react-native/Libraries/Core/Timers/JSTimers.js:418:6)
    at __callImmediates (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:411:6)
    at __guard$argument_0 (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:187:6)
    at __guard (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:368:11)
    at flushedQueue (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:186:6)
    at callFunctionReturnFlushedQueue (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:112:17)`,
  },
];

const anrException: ExceptionSpec = {
  key: "main_thread_blocked",
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
          class_name: "com.facebook.react.uimanager.NativeViewHierarchyManager",
          method_name: "updateProperties",
          file_name: "NativeViewHierarchyManager.java",
          line_num: 170,
          in_app: false,
        },
        {
          class_name:
            "com.facebook.react.uimanager.UIViewOperationQueue$UpdatePropertiesOperation",
          method_name: "execute",
          file_name: "UIViewOperationQueue.java",
          line_num: 143,
          in_app: false,
        },
        {
          class_name: "com.facebook.react.uimanager.UIViewOperationQueue$1",
          method_name: "run",
          file_name: "UIViewOperationQueue.java",
          line_num: 917,
          in_app: false,
        },
        {
          class_name: "com.facebook.react.uimanager.UIViewOperationQueue",
          method_name: "flushPendingBatches",
          file_name: "UIViewOperationQueue.java",
          line_num: 1025,
          in_app: false,
        },
        {
          class_name:
            "com.facebook.react.uimanager.UIViewOperationQueue$DispatchUIFrameCallback",
          method_name: "doFrameGuarded",
          file_name: "UIViewOperationQueue.java",
          line_num: 1112,
          in_app: false,
        },
        {
          class_name: "com.facebook.react.uimanager.GuardedFrameCallback",
          method_name: "doFrame",
          file_name: "GuardedFrameCallback.java",
          line_num: 31,
          in_app: false,
        },
        {
          class_name:
            "com.facebook.react.modules.core.ReactChoreographer$ReactChoreographerDispatcher",
          method_name: "doFrame",
          file_name: "ReactChoreographer.java",
          line_num: 169,
          in_app: false,
        },
        {
          class_name:
            "com.facebook.react.modules.core.ChoreographerCompat$FrameCallback$1",
          method_name: "doFrame",
          file_name: "ChoreographerCompat.java",
          line_num: 84,
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
          class_name: "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
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
      name: "mqt_js",
      frames: [
        {
          class_name: "com.facebook.react.bridge.CatalystInstanceImpl",
          method_name: "jniCallJSFunction",
          file_name: "CatalystInstanceImpl.java",
          line_num: -2,
          in_app: false,
        },
        {
          class_name: "com.facebook.react.bridge.CatalystInstanceImpl",
          method_name: "callFunction",
          file_name: "CatalystInstanceImpl.java",
          line_num: 408,
          in_app: false,
        },
        {
          class_name:
            "com.facebook.react.bridge.CatalystInstanceImpl$PendingJSCall",
          method_name: "call",
          file_name: "CatalystInstanceImpl.java",
          line_num: 595,
          in_app: false,
        },
        {
          class_name: "com.facebook.react.bridge.queue.NativeRunnable",
          method_name: "run",
          file_name: "NativeRunnable.java",
          line_num: -2,
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
          class_name:
            "com.facebook.react.bridge.queue.MessageQueueThreadImpl$4",
          method_name: "run",
          file_name: "MessageQueueThreadImpl.java",
          line_num: 228,
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
      name: "mqt_native_modules",
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
          class_name:
            "com.facebook.react.bridge.queue.MessageQueueThreadImpl$4",
          method_name: "run",
          file_name: "MessageQueueThreadImpl.java",
          line_num: 228,
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
  file_name: "NativeViewHierarchyManager.java",
  method_name: "updateProperties",
  line_number: 170,
  stacktrace: `sh.measure.android.anr.AnrError: Application Not Responding for at least 5s
	at com.facebook.react.uimanager.NativeViewHierarchyManager.updateProperties(NativeViewHierarchyManager.java:170)
	at com.facebook.react.uimanager.UIViewOperationQueue$UpdatePropertiesOperation.execute(UIViewOperationQueue.java:143)
	at com.facebook.react.uimanager.UIViewOperationQueue$1.run(UIViewOperationQueue.java:917)
	at com.facebook.react.uimanager.UIViewOperationQueue.flushPendingBatches(UIViewOperationQueue.java:1025)
	at com.facebook.react.uimanager.UIViewOperationQueue$DispatchUIFrameCallback.doFrameGuarded(UIViewOperationQueue.java:1112)
	at com.facebook.react.uimanager.GuardedFrameCallback.doFrame(GuardedFrameCallback.java:31)
	at com.facebook.react.modules.core.ReactChoreographer$ReactChoreographerDispatcher.doFrame(ReactChoreographer.java:169)
	at com.facebook.react.modules.core.ChoreographerCompat$FrameCallback$1.doFrame(ChoreographerCompat.java:84)
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
};

// Android reports a fatal JS error twice: the JS SDK records the TypeError, then
// the native SDK records this JavascriptException when ExceptionsManagerModule
// rethrows it.
const androidJsFatalCrash: ExceptionSpec = {
  key: "js_fatal_native",
  kind: "exception",
  type: "com.facebook.react.common.JavascriptException",
  message:
    "TypeError: Cannot read property 'price' of undefined, stack:\ngetProductPrice@src/screens/ProductDetailScreen.tsx:84:23\nrenderProductPrice@src/screens/ProductDetailScreen.tsx:132:31\nProductDetailScreen@src/screens/ProductDetailScreen.tsx:158:12",
  severity: "fatal",
  handled: false,
  foreground: true,
  framework: "jvm",
  exceptions: [
    {
      type: "com.facebook.react.common.JavascriptException",
      message:
        "TypeError: Cannot read property 'price' of undefined, stack:\ngetProductPrice@src/screens/ProductDetailScreen.tsx:84:23\nrenderProductPrice@src/screens/ProductDetailScreen.tsx:132:31\nProductDetailScreen@src/screens/ProductDetailScreen.tsx:158:12",
      thread_name: "mqt_native_modules",
      thread_sequence: 0,
      frames: [
        {
          class_name: "com.facebook.react.modules.core.ExceptionsManagerModule",
          method_name: "reportException",
          file_name: "ExceptionsManagerModule.java",
          line_num: 81,
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
          class_name: "com.facebook.react.bridge.JavaMethodWrapper",
          method_name: "invoke",
          file_name: "JavaMethodWrapper.java",
          line_num: 372,
          in_app: false,
        },
        {
          class_name: "com.facebook.react.bridge.JavaModuleWrapper",
          method_name: "invoke",
          file_name: "JavaModuleWrapper.java",
          line_num: 146,
          in_app: false,
        },
        {
          class_name: "com.facebook.react.bridge.queue.NativeRunnable",
          method_name: "run",
          file_name: "NativeRunnable.java",
          line_num: -2,
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
          class_name:
            "com.facebook.react.bridge.queue.MessageQueueThreadHandler",
          method_name: "dispatchMessage",
          file_name: "MessageQueueThreadHandler.java",
          line_num: 27,
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
          class_name:
            "com.facebook.react.bridge.queue.MessageQueueThreadImpl$4",
          method_name: "run",
          file_name: "MessageQueueThreadImpl.java",
          line_num: 228,
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
          class_name: "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
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
      name: "mqt_js",
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
          class_name:
            "com.facebook.react.bridge.queue.MessageQueueThreadImpl$4",
          method_name: "run",
          file_name: "MessageQueueThreadImpl.java",
          line_num: 228,
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
  file_name: "ExceptionsManagerModule.java",
  method_name: "reportException",
  line_number: 81,
  stacktrace: `com.facebook.react.common.JavascriptException: TypeError: Cannot read property 'price' of undefined, stack:
getProductPrice@src/screens/ProductDetailScreen.tsx:84:23
renderProductPrice@src/screens/ProductDetailScreen.tsx:132:31
ProductDetailScreen@src/screens/ProductDetailScreen.tsx:158:12
	at com.facebook.react.modules.core.ExceptionsManagerModule.reportException(ExceptionsManagerModule.java:81)
	at java.lang.reflect.Method.invoke(Method.java:-2)
	at com.facebook.react.bridge.JavaMethodWrapper.invoke(JavaMethodWrapper.java:372)
	at com.facebook.react.bridge.JavaModuleWrapper.invoke(JavaModuleWrapper.java:146)
	at com.facebook.react.bridge.queue.NativeRunnable.run(NativeRunnable.java:-2)
	at android.os.Handler.handleCallback(Handler.java:942)
	at android.os.Handler.dispatchMessage(Handler.java:99)
	at com.facebook.react.bridge.queue.MessageQueueThreadHandler.dispatchMessage(MessageQueueThreadHandler.java:27)
	at android.os.Looper.loopOnce(Looper.java:201)
	at android.os.Looper.loop(Looper.java:288)
	at com.facebook.react.bridge.queue.MessageQueueThreadImpl$4.run(MessageQueueThreadImpl.java:228)
	at java.lang.Thread.run(Thread.java:1012)`,
};

const iosJsFatalCrash: ExceptionSpec = {
  key: "js_fatal_native",
  kind: "exception",
  type: "SIGABRT",
  message: "",
  severity: "fatal",
  handled: false,
  foreground: true,
  framework: "apple",
  exceptions: [
    {
      type: "RCTFatalException",
      message:
        "Unhandled JS Exception: TypeError: Cannot read property 'price' of undefined",
      signal: "SIGABRT",
      thread_name: "com.facebook.react.ExceptionsManagerQueue",
      os_build_number: "22C161",
      thread_sequence: 5,
      frames: [
        {
          frame_index: 0,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b4ee6c",
          offset: 8,
          method_name: "__pthread_kill",
          in_app: false,
        },
        {
          frame_index: 1,
          binary_name: "libsystem_pthread.dylib",
          binary_address: "00000001fb83b000",
          symbol_address: "00000001fb83cb34",
          offset: 268,
          method_name: "pthread_kill",
          in_app: false,
        },
        {
          frame_index: 2,
          binary_name: "libsystem_c.dylib",
          binary_address: "00000001a84f6000",
          symbol_address: "00000001a8573a50",
          offset: 124,
          method_name: "abort",
          in_app: false,
        },
        {
          frame_index: 3,
          binary_name: "AcmeRN",
          binary_address: "0000000102d18000",
          symbol_address: "0000000102ebcc30",
          offset: 596,
          method_name: "RCTFatal",
          file_name: "RCTAssert.m",
          line_num: 147,
          in_app: true,
        },
        {
          frame_index: 4,
          binary_name: "AcmeRN",
          binary_address: "0000000102d18000",
          symbol_address: "0000000102ebed10",
          offset: 348,
          method_name:
            "-[RCTExceptionsManager reportFatal:stack:exceptionId:extraDataAsJSON:]",
          file_name: "RCTExceptionsManager.mm",
          line_num: 82,
          in_app: true,
        },
        {
          frame_index: 5,
          binary_name: "AcmeRN",
          binary_address: "0000000102d18000",
          symbol_address: "0000000102ebef44",
          offset: 620,
          method_name: "-[RCTExceptionsManager reportException:]",
          file_name: "RCTExceptionsManager.mm",
          line_num: 128,
          in_app: true,
        },
        {
          frame_index: 6,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca0d2c4",
          offset: 148,
          method_name: "__invoking___",
          in_app: false,
        },
        {
          frame_index: 7,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca0cf30",
          offset: 428,
          method_name: "-[NSInvocation invoke]",
          in_app: false,
        },
        {
          frame_index: 8,
          binary_name: "AcmeRN",
          binary_address: "0000000102d18000",
          symbol_address: "0000000102ecac88",
          offset: 1012,
          method_name: "-[RCTModuleMethod invokeWithBridge:module:arguments:]",
          file_name: "RCTModuleMethod.mm",
          line_num: 637,
          in_app: true,
        },
        {
          frame_index: 9,
          binary_name: "AcmeRN",
          binary_address: "0000000102d18000",
          symbol_address: "0000000102ecca10",
          offset: 1500,
          method_name:
            "facebook::react::invokeInner(RCTBridge*, RCTModuleData*, unsigned int, folly::dynamic const&, int)",
          file_name: "RCTNativeModule.mm",
          line_num: 184,
          in_app: true,
        },
        {
          frame_index: 10,
          binary_name: "AcmeRN",
          binary_address: "0000000102d18000",
          symbol_address: "0000000102eccc90",
          offset: 92,
          method_name:
            "facebook::react::RCTNativeModule::invoke(unsigned int, folly::dynamic&&, int)::$_0::operator()() const",
          file_name: "RCTNativeModule.mm",
          line_num: 100,
          in_app: true,
        },
        {
          frame_index: 11,
          binary_name: "libdispatch.dylib",
          binary_address: "000000019be30000",
          symbol_address: "000000019be4be84",
          offset: 32,
          method_name: "_dispatch_call_block_and_release",
          in_app: false,
        },
        {
          frame_index: 12,
          binary_name: "libdispatch.dylib",
          binary_address: "000000019be30000",
          symbol_address: "000000019be561e4",
          offset: 20,
          method_name: "_dispatch_client_callout",
          in_app: false,
        },
        {
          frame_index: 13,
          binary_name: "libdispatch.dylib",
          binary_address: "000000019be30000",
          symbol_address: "000000019be41148",
          offset: 748,
          method_name: "_dispatch_lane_serial_drain",
          in_app: false,
        },
        {
          frame_index: 14,
          binary_name: "libdispatch.dylib",
          binary_address: "000000019be30000",
          symbol_address: "000000019be4087c",
          offset: 432,
          method_name: "_dispatch_lane_invoke",
          in_app: false,
        },
        {
          frame_index: 15,
          binary_name: "libdispatch.dylib",
          binary_address: "000000019be30000",
          symbol_address: "000000019be4f098",
          offset: 404,
          method_name: "_dispatch_workloop_worker_thread",
          in_app: false,
        },
        {
          frame_index: 16,
          binary_name: "libsystem_pthread.dylib",
          binary_address: "00000001fb83b000",
          symbol_address: "00000001fb83c374",
          offset: 288,
          method_name: "_pthread_wqthread",
          in_app: false,
        },
        {
          frame_index: 17,
          binary_name: "libsystem_pthread.dylib",
          binary_address: "00000001fb83b000",
          symbol_address: "00000001fb83c390",
          offset: 8,
          method_name: "start_wqthread",
          in_app: false,
        },
      ],
    },
  ],
  threads: [
    {
      name: "com.apple.main-thread",
      frames: [
        {
          frame_index: 0,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b55cd4",
          offset: 8,
          method_name: "mach_msg2_trap",
          in_app: false,
        },
        {
          frame_index: 1,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b5630c",
          offset: 76,
          method_name: "mach_msg2_internal",
          in_app: false,
        },
        {
          frame_index: 2,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca57ea4",
          offset: 160,
          method_name: "__CFRunLoopServiceMachPort",
          in_app: false,
        },
        {
          frame_index: 3,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca21f94",
          offset: 1188,
          method_name: "__CFRunLoopRun",
          in_app: false,
        },
        {
          frame_index: 4,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca211d0",
          offset: 532,
          method_name: "CFRunLoopRunSpecific",
          in_app: false,
        },
        {
          frame_index: 5,
          binary_name: "GraphicsServices",
          binary_address: "0000000241f42000",
          symbol_address: "0000000241f449bc",
          offset: 164,
          method_name: "GSEventRunModal",
          in_app: false,
        },
        {
          frame_index: 6,
          binary_name: "UIKitCore",
          binary_address: "00000001a25c4000",
          symbol_address: "00000001a277bc3c",
          offset: 816,
          method_name: "-[UIApplication _run]",
          in_app: false,
        },
        {
          frame_index: 7,
          binary_name: "UIKitCore",
          binary_address: "00000001a25c4000",
          symbol_address: "00000001a277be64",
          offset: 340,
          method_name: "UIApplicationMain",
          in_app: false,
        },
        {
          frame_index: 8,
          binary_name: "AcmeRN",
          binary_address: "0000000102d18000",
          symbol_address: "0000000102d352c4",
          offset: 24,
          method_name: "main",
          in_app: true,
        },
        {
          frame_index: 9,
          binary_name: "dyld",
          binary_address: "00000001bd0f4000",
          symbol_address: "00000001bd0f5d1c",
          offset: 2724,
          method_name: "start",
          in_app: false,
        },
      ],
    },
    {
      name: "com.facebook.react.JavaScript",
      frames: [
        {
          frame_index: 0,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b55cd4",
          offset: 8,
          method_name: "mach_msg2_trap",
          in_app: false,
        },
        {
          frame_index: 1,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b5630c",
          offset: 76,
          method_name: "mach_msg2_internal",
          in_app: false,
        },
        {
          frame_index: 2,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca57ea4",
          offset: 160,
          method_name: "__CFRunLoopServiceMachPort",
          in_app: false,
        },
        {
          frame_index: 3,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca21f94",
          offset: 1188,
          method_name: "__CFRunLoopRun",
          in_app: false,
        },
        {
          frame_index: 4,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca211d0",
          offset: 532,
          method_name: "CFRunLoopRunSpecific",
          in_app: false,
        },
        {
          frame_index: 5,
          binary_name: "AcmeRN",
          binary_address: "0000000102d18000",
          symbol_address: "0000000102fd9a40",
          offset: 232,
          method_name: "-[RCTCxxBridge runJSRunLoopThread]",
          in_app: true,
        },
        {
          frame_index: 6,
          binary_name: "Foundation",
          binary_address: "0000000199ca4000",
          symbol_address: "0000000199d1873c",
          offset: 104,
          method_name: "-[NSThread main]",
          in_app: false,
        },
        {
          frame_index: 7,
          binary_name: "Foundation",
          binary_address: "0000000199ca4000",
          symbol_address: "0000000199d18804",
          offset: 732,
          method_name: "__NSThread__start__",
          in_app: false,
        },
        {
          frame_index: 8,
          binary_name: "libsystem_pthread.dylib",
          binary_address: "00000001fb83b000",
          symbol_address: "00000001fb83c438",
          offset: 136,
          method_name: "_pthread_start",
          in_app: false,
        },
      ],
    },
    {
      name: "com.facebook.react.ShadowQueue",
      frames: [
        {
          frame_index: 0,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b4ee6c",
          offset: 8,
          method_name: "semaphore_wait_trap",
          in_app: false,
        },
        {
          frame_index: 1,
          binary_name: "libdispatch.dylib",
          binary_address: "000000019be30000",
          symbol_address: "000000019be4be84",
          offset: 148,
          method_name: "_dispatch_sema4_wait",
          in_app: false,
        },
        {
          frame_index: 2,
          binary_name: "libdispatch.dylib",
          binary_address: "000000019be30000",
          symbol_address: "000000019be561e4",
          offset: 16,
          method_name: "_dispatch_semaphore_wait_slow",
          in_app: false,
        },
        {
          frame_index: 3,
          binary_name: "libdispatch.dylib",
          binary_address: "000000019be30000",
          symbol_address: "000000019be41148",
          offset: 596,
          method_name: "_dispatch_lane_barrier_sync_invoke_and_complete",
          in_app: false,
        },
        {
          frame_index: 4,
          binary_name: "libdispatch.dylib",
          binary_address: "000000019be30000",
          symbol_address: "000000019be4e900",
          offset: 360,
          method_name: "_dispatch_worker_thread2",
          in_app: false,
        },
        {
          frame_index: 5,
          binary_name: "libsystem_pthread.dylib",
          binary_address: "00000001fb83b000",
          symbol_address: "00000001fb83c374",
          offset: 232,
          method_name: "_pthread_wqthread",
          in_app: false,
        },
      ],
    },
    {
      name: "hades",
      frames: [
        {
          frame_index: 0,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b51a40",
          offset: 8,
          method_name: "__psynch_cvwait",
          in_app: false,
        },
        {
          frame_index: 1,
          binary_name: "libsystem_pthread.dylib",
          binary_address: "00000001fb83b000",
          symbol_address: "00000001fb83dc20",
          offset: 48,
          method_name: "_pthread_cond_wait",
          in_app: false,
        },
        {
          frame_index: 2,
          binary_name: "hermes",
          binary_address: "0000000104f30000",
          symbol_address: "00000001050d4c80",
          offset: 196,
          method_name: "hermes::vm::HadesGC::Executor::worker()",
          in_app: false,
        },
        {
          frame_index: 3,
          binary_name: "hermes",
          binary_address: "0000000104f30000",
          symbol_address: "00000001050d4d44",
          offset: 84,
          method_name:
            "void* std::__1::__thread_proxy[abi:ne180100]<std::__1::tuple<std::__1::unique_ptr<std::__1::__thread_struct, std::__1::default_delete<std::__1::__thread_struct>>, void (*)()>>(void*)",
          in_app: false,
        },
        {
          frame_index: 4,
          binary_name: "libsystem_pthread.dylib",
          binary_address: "00000001fb83b000",
          symbol_address: "00000001fb83c438",
          offset: 136,
          method_name: "_pthread_start",
          in_app: false,
        },
      ],
    },
    {
      name: "com.apple.uikit.eventfetch-thread",
      frames: [
        {
          frame_index: 0,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b55cd4",
          offset: 8,
          method_name: "mach_msg2_trap",
          in_app: false,
        },
        {
          frame_index: 1,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b5630c",
          offset: 76,
          method_name: "mach_msg2_internal",
          in_app: false,
        },
        {
          frame_index: 2,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca57ea4",
          offset: 160,
          method_name: "__CFRunLoopServiceMachPort",
          in_app: false,
        },
        {
          frame_index: 3,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca21f94",
          offset: 1188,
          method_name: "__CFRunLoopRun",
          in_app: false,
        },
        {
          frame_index: 4,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca211d0",
          offset: 532,
          method_name: "CFRunLoopRunSpecific",
          in_app: false,
        },
        {
          frame_index: 5,
          binary_name: "Foundation",
          binary_address: "0000000199ca4000",
          symbol_address: "0000000199ca5cf0",
          offset: 212,
          method_name: "-[NSRunLoop(NSRunLoop) runMode:beforeDate:]",
          in_app: false,
        },
        {
          frame_index: 6,
          binary_name: "Foundation",
          binary_address: "0000000199ca4000",
          symbol_address: "0000000199ca5bd8",
          offset: 64,
          method_name: "-[NSRunLoop(NSRunLoop) runUntilDate:]",
          in_app: false,
        },
        {
          frame_index: 7,
          binary_name: "UIKitCore",
          binary_address: "00000001a25c4000",
          symbol_address: "00000001a267aafc",
          offset: 420,
          method_name: "-[UIEventFetcher threadMain]",
          in_app: false,
        },
        {
          frame_index: 8,
          binary_name: "Foundation",
          binary_address: "0000000199ca4000",
          symbol_address: "0000000199d18804",
          offset: 732,
          method_name: "__NSThread__start__",
          in_app: false,
        },
        {
          frame_index: 9,
          binary_name: "libsystem_pthread.dylib",
          binary_address: "00000001fb83b000",
          symbol_address: "00000001fb83c438",
          offset: 136,
          method_name: "_pthread_start",
          in_app: false,
        },
      ],
    },
    {
      name: "com.apple.NSURLSession-work",
      frames: [
        {
          frame_index: 0,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b55cd4",
          offset: 8,
          method_name: "mach_msg2_trap",
          in_app: false,
        },
        {
          frame_index: 1,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b5630c",
          offset: 76,
          method_name: "mach_msg2_internal",
          in_app: false,
        },
        {
          frame_index: 2,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca57ea4",
          offset: 160,
          method_name: "__CFRunLoopServiceMachPort",
          in_app: false,
        },
        {
          frame_index: 3,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca21f94",
          offset: 1188,
          method_name: "__CFRunLoopRun",
          in_app: false,
        },
        {
          frame_index: 4,
          binary_name: "CoreFoundation",
          binary_address: "000000019c9f3000",
          symbol_address: "000000019ca211d0",
          offset: 532,
          method_name: "CFRunLoopRunSpecific",
          in_app: false,
        },
        {
          frame_index: 5,
          binary_name: "CFNetwork",
          binary_address: "00000001a1b18000",
          symbol_address: "00000001a1b453a8",
          offset: 492,
          method_name: "+[__CFN_CoreSchedulingSetRunnable _run:]",
          in_app: false,
        },
        {
          frame_index: 6,
          binary_name: "Foundation",
          binary_address: "0000000199ca4000",
          symbol_address: "0000000199d18804",
          offset: 732,
          method_name: "__NSThread__start__",
          in_app: false,
        },
        {
          frame_index: 7,
          binary_name: "libsystem_pthread.dylib",
          binary_address: "00000001fb83b000",
          symbol_address: "00000001fb83c438",
          offset: 136,
          method_name: "_pthread_start",
          in_app: false,
        },
      ],
    },
    {
      name: "Thread 10",
      frames: [
        {
          frame_index: 0,
          binary_name: "libsystem_kernel.dylib",
          binary_address: "00000001e6b4c000",
          symbol_address: "00000001e6b4d390",
          offset: 8,
          method_name: "__workq_kernreturn",
          in_app: false,
        },
        {
          frame_index: 1,
          binary_name: "libsystem_pthread.dylib",
          binary_address: "00000001fb83b000",
          symbol_address: "00000001fb83e3fc",
          offset: 368,
          method_name: "_pthread_wqthread",
          in_app: false,
        },
      ],
    },
  ],
  binary_images: [
    {
      name: "AcmeRN",
      arch: "arm64e",
      uuid: "b41d8e2c7a9f4c3d85e60f1a2b3c4d5e",
      path: "/private/var/containers/Bundle/Application/5C6D7E8F-9A0B-4C1D-8E2F-3A4B5C6D7E8F/AcmeRN.app/AcmeRN",
    },
    {
      name: "CFNetwork",
      arch: "arm64e",
      uuid: "4a0921b76bd83dd0a7b017d82dbbc75a",
      path: "/System/Library/Frameworks/CFNetwork.framework/CFNetwork",
    },
    {
      name: "CoreFoundation",
      arch: "arm64e",
      uuid: "6fc1e77958463275bf66955738404cf6",
      path: "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation",
    },
    {
      name: "Foundation",
      arch: "arm64e",
      uuid: "cf6b28c49795362ab5637b1b8c116282",
      path: "/System/Library/Frameworks/Foundation.framework/Foundation",
    },
    {
      name: "GraphicsServices",
      arch: "arm64e",
      uuid: "67164c20442f320b924e83c661869ab7",
      path: "/System/Library/PrivateFrameworks/GraphicsServices.framework/GraphicsServices",
    },
    {
      name: "UIKitCore",
      arch: "arm64e",
      uuid: "e83e034727d734bdb0d351666dfdfd76",
      path: "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
    },
    {
      name: "dyld",
      arch: "arm64e",
      uuid: "6c9a1e278d533f41b2a60e7c4d91b2f5",
      path: "/usr/lib/dyld",
    },
    {
      name: "hermes",
      arch: "arm64e",
      uuid: "6f2a9c14d83b4e57a01b2c3d4e5f6a7b",
      path: "/private/var/containers/Bundle/Application/5C6D7E8F-9A0B-4C1D-8E2F-3A4B5C6D7E8F/AcmeRN.app/Frameworks/hermes.framework/hermes",
    },
    {
      name: "libdispatch.dylib",
      arch: "arm64e",
      uuid: "ef0492a68ca538f097bbdf9bdb54c17a",
      path: "/usr/lib/system/libdispatch.dylib",
    },
    {
      name: "libsystem_c.dylib",
      arch: "arm64e",
      uuid: "c2be3ea9bf053c11b0ff90fbaad68c1c",
      path: "/usr/lib/system/libsystem_c.dylib",
    },
    {
      name: "libsystem_kernel.dylib",
      arch: "arm64e",
      uuid: "5ea2a24297863af8b8a97899ecc711c8",
      path: "/usr/lib/system/libsystem_kernel.dylib",
    },
    {
      name: "libsystem_pthread.dylib",
      arch: "arm64e",
      uuid: "5337239180ee3a5285d2b0d39816a60b",
      path: "/usr/lib/system/libsystem_pthread.dylib",
    },
  ],
  file_name: "RCTExceptionsManager.mm",
  method_name:
    "-[RCTExceptionsManager reportFatal:stack:exceptionId:extraDataAsJSON:]",
  line_number: 82,
  stacktrace: `com.facebook.react.ExceptionsManagerQueue:
  0   libsystem_kernel.dylib        0x00000001e6b4c000   __pthread_kill + 8
  1   libsystem_pthread.dylib       0x00000001fb83b000   pthread_kill + 268
  2   libsystem_c.dylib             0x00000001a84f6000   abort + 124
  3   AcmeRN                        0x0000000102d18000   RCTFatal   (RCTAssert.m:147)
  4   AcmeRN                        0x0000000102d18000   -[RCTExceptionsManager reportFatal:stack:exceptionId...   (RCTExceptionsManager.mm:82)
    Full symbol:-[RCTExceptionsManager reportFatal:stack:exceptionId:extraDataAsJSON:]
  5   AcmeRN                        0x0000000102d18000   -[RCTExceptionsManager reportException:]   (RCTExceptionsManager.mm:128)
  6   CoreFoundation                0x000000019c9f3000   __invoking___ + 148
  7   CoreFoundation                0x000000019c9f3000   -[NSInvocation invoke] + 428
  8   AcmeRN                        0x0000000102d18000   -[RCTModuleMethod invokeWithBridge:module:arguments:]   (RCTModuleMethod.mm:637)
  9   AcmeRN                        0x0000000102d18000   facebook::react::invokeInner(RCTBridge*, RCTModuleDa...   (RCTNativeModule.mm:184)
    Full symbol:facebook::react::invokeInner(RCTBridge*, RCTModuleData*, unsigned int, folly::dynamic const&, int)
 10   AcmeRN                        0x0000000102d18000   facebook::react::RCTNativeModule::invoke(unsigned in...   (RCTNativeModule.mm:100)
    Full symbol:facebook::react::RCTNativeModule::invoke(unsigned int, folly::dynamic&&, int)::$_0::operator()() const
 11   libdispatch.dylib             0x000000019be30000   _dispatch_call_block_and_release + 32
 12   libdispatch.dylib             0x000000019be30000   _dispatch_client_callout + 20
 13   libdispatch.dylib             0x000000019be30000   _dispatch_lane_serial_drain + 748
 14   libdispatch.dylib             0x000000019be30000   _dispatch_lane_invoke + 432
 15   libdispatch.dylib             0x000000019be30000   _dispatch_workloop_worker_thread + 404
 16   libsystem_pthread.dylib       0x00000001fb83b000   _pthread_wqthread + 288
 17   libsystem_pthread.dylib       0x00000001fb83b000   start_wqthread + 8

`,
};

const bindings = {
  screen: {
    login: "login",
    home: "home",
    products: "productlist",
    search: "search",
    product_detail: "productdetail",
    cart: "cart",
    checkout: "checkout",
    payment: "payment",
    order_confirmation: "orderconfirmation",
    profile: "profile",
    orders: "orders",
  },
  http: {
    products: "product_list",
    cart_add: "cart_add",
    cart_update: "cart_update",
    cart_remove: "cart_remove",
    promo: "coupon",
    orders: "orders",
    login: "login",
    profile: "profile",
    preferences: "preferences",
    payment_methods: "payment_methods",
  },
  span: {
    product_load: "product_load",
    checkout_flow: "checkout_flow",
    search_query: "search_query",
    cart_refresh: "cart_refresh",
  },
} as const;

type Reports = NonNullable<Parameters<typeof standardFlows>[1]["reports"]>;

function buildFlows(
  includeAnr: boolean,
  reports: Reports,
  confirmation: { variant: string; report: string },
): FlowSpec[] {
  const b = {
    ...bindings,
    wallet: includeAnr
      ? ("radio_google_pay" as const)
      : ("radio_apple_pay" as const),
  };
  const startup = {
    name: "app_info",
    attributes: { measure_rn_version: "0.3.1" },
  };
  const flows = standardFlows(b, {
    detailCrash: {
      fail: { span: SPAN_STEPS.productDetails, status: 404 },
      abortBefore: SPAN_STEPS.productRender,
      steps: [{ kind: "exception", exception: "price_type_error" }],
    },
    detailAnr: includeAnr
      ? [{ kind: "exception", exception: "main_thread_blocked" }]
      : undefined,
    cartHandled: {
      afterOpen: [
        { kind: "http", http: "cart_sync", outcome: "failure" },
        { kind: "exception", exception: "network_request_failed" },
        {
          kind: "log",
          severity: "warning",
          body: "Cart sync failed, showing the cart saved on this device",
        },
      ],
    },
    reports,
    sdkCustom: startup,
    keys: {
      detail_crash: "crash_price",
      purchase: "clean_browse_checkout",
      cart_handled: "cart_network_failure",
      search_bug: "bug_report_search",
      login: "login_profile",
      profile: "browse_profile",
      anr_home: "anr_session",
    },
  });
  flows.push(
    new Journey(b, startup)
      .open()
      .toProducts(2)
      .inspect("card_product_1", { size: 1, addToCart: true })
      .openCart()
      .checkout({
        methodsFailure: [
          { kind: "exception", exception: "payment_method_load_failed" },
        ],
        pay: "wallet",
      })
      .afterOrder()
      .build("payment_handled_error", "Payment methods fail to load, handled"),
    new Journey(b, startup)
      .open()
      .search(true, "hiking")
      .inspect("row_result_3", { size: 1, reviews: true })
      .inspect("row_result_0", { size: 2, addToCart: true })
      .openCart()
      .checkout({
        workAddress: true,
        confirmationVariant: confirmation.variant,
      })
      .bugReport(confirmation.report)
      .afterOrder()
      .build("clean_search", "Search, buy, report a date bug"),
  );
  return flows;
}

const androidApp: AppSpec = {
  id: "7c2e5f18-9a4b-4d6e-8f01-2b3c4d5e6f70",
  name: "Acme - RN Android",
  os: "android",
  framework: "react_native",
  uniqueId: "com.acme.shop.rn",
  sdkVersion: "0.20.0",
  versions: [
    { name: "1.9.2", code: "192", releasedDaysAgo: 13 },
    { name: "1.9.1", code: "191", releasedDaysAgo: 29 },
    { name: "1.8.0", code: "180", releasedDaysAgo: 216 },
  ],
  candidate: { name: "1.9.3", code: "193" },
  mappingTypes: ["proguard", "jsbundle"],
  createdDaysAgo: 210,
  dailySessions: 180_000,
  crashFreeRate: 0.98673,
  anrFreeRate: 0.99538,
  perceivedCrashFreeRate: 0.99217,
};

const iosApp: AppSpec = {
  id: "9e1d3c5b-7a2f-4b8c-a6d4-0f1e2d3c4b5a",
  name: "Acme - RN iOS",
  os: "ios",
  framework: "react_native",
  uniqueId: "sh.acme.AcmeRN",
  sdkVersion: "0.13.2",
  versions: [
    { name: "1.9.2", code: "2031", releasedDaysAgo: 12 },
    { name: "1.9.1", code: "2027", releasedDaysAgo: 216 },
  ],
  candidate: { name: "1.9.3", code: "2036" },
  mappingTypes: ["dsym", "jsbundle"],
  createdDaysAgo: 210,
  dailySessions: 120_000,
  crashFreeRate: 0.99138,
  perceivedCrashFreeRate: 0.99461,
};

const androidSessions: SessionScript[] = [
  { flow: "crash_price", user: 0, version: 0, agoMinutes: 15, launch: "cold" },
  {
    flow: "clean_browse_checkout",
    user: 1,
    version: 0,
    agoMinutes: 50,
    launch: "warm",
    memoryLeak: true,
  },
  {
    flow: "bug_report_search",
    user: 2,
    version: 0,
    agoMinutes: 85,
    launch: "hot",
  },
  {
    flow: "cart_network_failure",
    user: 2,
    version: 0,
    agoMinutes: 120,
    launch: "hot",
  },
  {
    flow: "login_profile",
    user: 3,
    version: 0,
    agoMinutes: 155,
    launch: "cold",
    memoryLeak: true,
  },
  {
    flow: "crash_price",
    user: 1,
    version: 2,
    agoMinutes: 20000,
    launch: "warm",
  },
  { flow: "anr_session", user: 0, version: 0, agoMinutes: 190, launch: "cold" },
  {
    flow: "payment_handled_error",
    user: 4,
    version: 1,
    agoMinutes: 225,
    launch: "cold",
  },
  {
    flow: "clean_search",
    user: 3,
    version: 1,
    agoMinutes: 4000,
    launch: "warm",
  },
  {
    flow: "clean_browse_checkout",
    user: 4,
    version: 1,
    agoMinutes: 9000,
    launch: "cold",
  },
];

const iosSessions: SessionScript[] = [
  { flow: "crash_price", user: 0, version: 0, agoMinutes: 12, launch: "cold" },
  {
    flow: "clean_browse_checkout",
    user: 1,
    version: 0,
    agoMinutes: 55,
    launch: "warm",
    memoryLeak: true,
  },
  {
    flow: "bug_report_search",
    user: 2,
    version: 0,
    agoMinutes: 90,
    launch: "cold",
  },
  {
    flow: "cart_network_failure",
    user: 2,
    version: 0,
    agoMinutes: 125,
    launch: "hot",
  },
  {
    flow: "login_profile",
    user: 3,
    version: 0,
    agoMinutes: 160,
    launch: "cold",
    memoryLeak: true,
  },
  {
    flow: "crash_price",
    user: 4,
    version: 1,
    agoMinutes: 9000,
    launch: "warm",
  },
  {
    flow: "payment_handled_error",
    user: 4,
    version: 0,
    agoMinutes: 195,
    launch: "hot",
  },
  {
    flow: "clean_search",
    user: 0,
    version: 0,
    agoMinutes: 3000,
    launch: "cold",
  },
  {
    flow: "clean_browse_checkout",
    user: 1,
    version: 1,
    agoMinutes: 20000,
    launch: "warm",
  },
  {
    flow: "browse_profile",
    user: 3,
    version: 1,
    agoMinutes: 270,
    launch: "cold",
  },
];

export const rnAndroidScenario: PlatformScenario = {
  ids: { product: "numbered", orderPrefix: "o_" },
  app: androidApp,
  host: { className: "com.acme.shop.rn.MainActivity", lifecycle: "activity" },
  ui: {
    style: "rn_android",
    screens: {
      home: "home",
      productlist: "products",
      productdetail: "product_detail",
      cart: "cart",
      checkout: "checkout",
      payment: "payment",
      orderconfirmation: "order_confirmation",
      orders: "orders",
      search: "search",
      profile: "profile",
      login: "login",
    },
  },
  screens,
  devices: androidDevices,
  users: [
    { person: 19, device: 0, locale: "en-US" },
    { person: 20, device: 1, locale: "en-US" },
    { person: 21, device: 2, locale: "en-US" },
    { person: 22, device: 0, locale: "es-US" },
    { person: 23, device: 1, locale: "en-US" },
  ],
  http: httpSpecsFor("okhttp"),
  exceptions: [...jsExceptions, anrException, androidJsFatalCrash],
  spans: androidSpans,
  flows: buildFlows(
    true,
    {
      search: (j) =>
        j
          .tap("field_search")
          .type("")
          .bugReport(
            "I cleared the search box but the results for running are still showing underneath. I have to leave search and come back to start over.",
          ),
    },
    {
      variant: "early_date",
      report:
        "Order confirmation shows a delivery date one day earlier than the date checkout gave me.",
    },
  ),
  sessions: androidSessions,
  launch: {
    coldMs: [800, 1500],
    warmMs: [300, 600],
    hotMs: [110, 200],
  },
  threadNames: { main: "main", network: "OkHttp Dispatcher" },
};

export const rnIosScenario: PlatformScenario = {
  ids: { product: "numbered", orderPrefix: "o_" },
  app: iosApp,
  host: { className: "RNSNavigationController", lifecycle: "view_controller" },
  ui: {
    style: "rn_ios",
    screens: {
      home: "home",
      productlist: "products",
      productdetail: "product_detail",
      cart: "cart",
      checkout: "checkout",
      payment: "payment",
      orderconfirmation: "order_confirmation",
      orders: "orders",
      search: "search",
      profile: "profile",
      login: "login",
    },
  },
  screens,
  devices: iosDevices,
  users: [
    { person: 24, device: 0, locale: "en_US" },
    { person: 25, device: 1, locale: "en_US" },
    { person: 26, device: 2, locale: "en_US" },
    { person: 27, device: 0, locale: "en_US" },
    { person: 28, device: 1, locale: "en_US" },
  ],
  http: httpSpecsFor("URLSession"),
  exceptions: [...jsExceptions, iosJsFatalCrash],
  spans: iosSpans,
  flows: buildFlows(
    false,
    {
      search: (j) =>
        j
          .tap("chip_filter_0")
          .bugReport(
            "I tapped Under $100 on my running search and nothing changed. The Trail Runner GTX at $129 is still at the top of the list.",
          ),
    },
    {
      variant: "home_address",
      report:
        "I picked my work address at checkout, but the confirmation says it's being delivered to Home.",
    },
  ),
  sessions: iosSessions,
  launch: {
    coldMs: [650, 1400],
    warmMs: [260, 560],
    hotMs: [90, 190],
  },
  threadNames: {
    main: "com.apple.main-thread",
    network: "com.apple.NSURLSession-delegate",
  },
};
