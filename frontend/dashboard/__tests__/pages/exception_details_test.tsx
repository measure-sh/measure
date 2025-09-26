import { ExceptionsType } from '@/app/api/api_calls'
import { ExceptionsDetails } from '@/app/components/exceptions_details'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

// Global replace mock for router.replace
const replaceMock = jest.fn()

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
    // By default, return empty search params.
    useSearchParams: () => new URLSearchParams(),
}))

// Mock AIChatContext
jest.mock('@/app/context/ai_chat_context', () => ({
    useAIChatContext: jest.fn(() => ({
        pageContext: {
            enable: false,
            action: "",
            content: "",
            fileName: "",
        },
        setPageContext: jest.fn(),
    })),
    AIChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock time utils
jest.mock('@/app/utils/time_utils', () => ({
    formatDateToHumanReadableDateTime: jest.fn(() => 'January 1, 2020 12:00 AM'),
}))

// Mock API calls and constants for exceptions details with valid data.
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    emptyExceptionsOverviewResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    emptyCrashExceptionsDetailsResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    emptyAnrExceptionsDetailsResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    ExceptionsDetailsApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    SessionTimelineApiStatus: {
        Loading: 'Loading',
        Success: 'Success',
        Error: 'Error',
        Cancelled: 'Cancelled',
    },
    ExceptionsType: {
        Crash: 'crash',
        Anr: 'anr'
    },
    FilterSource: {
        Crashes: 'crashes',
        Anrs: 'anrs',
        Events: 'events'
    },
    fetchExceptionsDetailsFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                results: [
                    {
                        id: 'exception1',
                        session_id: 'session1',
                        timestamp: '2020-01-01T00:00:00Z',
                        type: 'NullPointerException',
                        thread_name: 'main',
                        attribute: {
                            installation_id: 'installation1',
                            app_version: '1.0.0',
                            app_build: '123',
                            app_unique_id: 'unique1',
                            measure_sdk_version: '2.0.0',
                            platform: 'Android',
                            thread_name: 'main',
                            user_id: 'user1',
                            device_name: 'Pixel 6 Pro',
                            device_model: 'Pixel 6 Pro',
                            device_manufacturer: 'Google ',
                            device_type: 'phone',
                            device_is_foldable: false,
                            device_is_physical: true,
                            device_density_dpi: 420,
                            device_width_px: 1080,
                            device_height_px: 2340,
                            device_density: 3.0,
                            device_locale: 'en_US',
                            os_name: 'Android',
                            os_version: '12',
                            network_type: 'WiFi',
                            network_provider: 'Verizon',
                            network_generation: '5G'
                        },
                        exception: {
                            title: 'NullPointerException',
                            stacktrace: 'java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference\n\tat com.example.MainActivity.onCreate(MainActivity.java:42)'
                        },
                        anr: {
                            title: 'ANR in com.example.MainActivity',
                            stacktrace: 'ANR in com.example.MainActivity\n\tat com.example.MainActivity.onResume(MainActivity.java:65)'
                        },
                        attachments: [
                            {
                                id: 'attachment1',
                                name: 'screenshot.png',
                                type: 'image/png',
                                key: 'screenshot1',
                                location: '/images/screenshot1.png'
                            }
                        ],
                        threads: [
                            {
                                name: 'main',
                                frames: [
                                    'java.lang.Thread.sleep(Native Method)',
                                    'com.example.MainActivity$1.run(MainActivity.java:52)'
                                ]
                            },
                            {
                                name: 'RenderThread',
                                frames: [
                                    'android.view.ThreadedRenderer.nativeSyncAndDrawFrame(Native Method)',
                                    'android.view.ThreadedRenderer.syncAndDrawFrame(ThreadedRenderer.java:144)'
                                ]
                            }
                        ],
                        attributes: {
                            customAttr1: 'value1',
                            customAttr2: 'value2'
                        }
                    }
                ],
                meta: { previous: true, next: true },
            }
        })
    ),
    fetchSessionTimelineFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
                "attribute": {
                    "installation_id": "1fefa265-9e6b-45d8-aa83-23b03070c06e",
                    "app_version": "0.11.0-SNAPSHOT",
                    "app_build": "29137627",
                    "app_unique_id": "sh.measure.sample",
                    "measure_sdk_version": "0.11.0-SNAPSHOT",
                    "platform": "android",
                    "thread_name": "msr-default",
                    "user_id": "dummy-user-id",
                    "device_name": "sunfish",
                    "device_model": "Pixel 4a",
                    "device_manufacturer": "Google",
                    "device_type": "phone",
                    "device_is_foldable": false,
                    "device_is_physical": true,
                    "device_density_dpi": 440,
                    "device_width_px": 1080,
                    "device_height_px": 2138,
                    "device_density": 2.75,
                    "device_locale": "en-US",
                    "device_low_power_mode": false,
                    "device_thermal_throttling_enabled": false,
                    "device_cpu_arch": "",
                    "os_name": "android",
                    "os_version": "33",
                    "os_page_size": 0,
                    "network_type": "wifi",
                    "network_provider": "unknown",
                    "network_generation": "unknown"
                },
                "cpu_usage": [
                    {
                        "timestamp": "2025-05-26T11:12:43.525Z",
                        "value": 0
                    },
                    {
                        "timestamp": "2025-05-26T11:12:46.528Z",
                        "value": 1.625
                    },
                    {
                        "timestamp": "2025-05-26T11:12:49.529Z",
                        "value": 0.625
                    },
                    {
                        "timestamp": "2025-05-26T11:12:52.53Z",
                        "value": 2.666666666666667
                    }
                ],
                "duration": 10741,
                "memory_usage": [
                    {
                        "java_max_heap": 262144,
                        "java_total_heap": 262144,
                        "java_free_heap": 259685,
                        "total_pss": 10846,
                        "rss": 105040,
                        "native_total_heap": 12612,
                        "native_free_heap": 1170,
                        "interval": 0,
                        "timestamp": "2025-05-26T11:12:43.58Z"
                    },
                    {
                        "java_max_heap": 262144,
                        "java_total_heap": 65536,
                        "java_free_heap": 58687,
                        "total_pss": 57496,
                        "rss": 135104,
                        "native_total_heap": 17752,
                        "native_free_heap": 1259,
                        "interval": 2056,
                        "timestamp": "2025-05-26T11:12:45.622Z"
                    },
                    {
                        "java_max_heap": 262144,
                        "java_total_heap": 65536,
                        "java_free_heap": 58391,
                        "total_pss": 57572,
                        "rss": 135240,
                        "native_total_heap": 17752,
                        "native_free_heap": 1229,
                        "interval": 2043,
                        "timestamp": "2025-05-26T11:12:47.679Z"
                    },
                    {
                        "java_max_heap": 262144,
                        "java_total_heap": 65536,
                        "java_free_heap": 57931,
                        "total_pss": 59015,
                        "rss": 136396,
                        "native_total_heap": 18520,
                        "native_free_heap": 1314,
                        "interval": 2055,
                        "timestamp": "2025-05-26T11:12:49.711Z"
                    },
                    {
                        "java_max_heap": 262144,
                        "java_total_heap": 65536,
                        "java_free_heap": 57162,
                        "total_pss": 59904,
                        "rss": 137996,
                        "native_total_heap": 19544,
                        "native_free_heap": 1307,
                        "interval": 2032,
                        "timestamp": "2025-05-26T11:12:51.738Z"
                    },
                    {
                        "java_max_heap": 262144,
                        "java_total_heap": 16384,
                        "java_free_heap": 7298,
                        "total_pss": 60499,
                        "rss": 138700,
                        "native_total_heap": 19544,
                        "native_free_heap": 1218,
                        "interval": 2028,
                        "timestamp": "2025-05-26T11:12:53.8Z"
                    }
                ],
                "memory_usage_absolute": null,
                "session_id": "81f06f23-4291-4590-a5df-c96d57d3c692",
                "threads": {
                    "main": [
                        {
                            "event_type": "custom",
                            "user_defined_attribute": {
                                "boolean": false,
                                "double": 1.7976931348623157e+308,
                                "float": 3.4028235e+38,
                                "integer": 2147483647,
                                "long": "9223372036854775807",
                                "string": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in"
                            },
                            "thread_name": "main",
                            "user_triggered": true,
                            "name": "custom-app-start\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
                            "timestamp": "2025-05-26T11:12:43.532Z"
                        },
                        {
                            "event_type": "lifecycle_activity",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "type": "created",
                            "class_name": "sh.measure.sample.ExceptionDemoActivity",
                            "intent": "",
                            "saved_instance_state": false,
                            "timestamp": "2025-05-26T11:12:43.549Z"
                        },
                        {
                            "event_type": "lifecycle_app",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "type": "foreground",
                            "timestamp": "2025-05-26T11:12:43.594Z"
                        },
                        {
                            "event_type": "lifecycle_activity",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "type": "resumed",
                            "class_name": "sh.measure.sample.ExceptionDemoActivity",
                            "intent": "",
                            "saved_instance_state": false,
                            "timestamp": "2025-05-26T11:12:43.596Z"
                        },
                        {
                            "event_type": "cold_launch",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "duration": 238,
                            "timestamp": "2025-05-26T11:12:43.672Z"
                        },
                        {
                            "event_type": "gesture_scroll",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "target": "android.widget.ScrollView",
                            "target_id": "sv_container",
                            "x": 302,
                            "y": 1978,
                            "end_x": 208,
                            "end_y": 1374,
                            "direction": "up",
                            "timestamp": "2025-05-26T11:12:49.251Z",
                            "attachments": [
                                {
                                    "id": "d2c8f7e4-91ab-4e75-b6fd-2c4f0de6e391",
                                    "name": "snapshot.json",
                                    "type": "layout_snapshot_json",
                                    "key": "d2c8f7e4-91ab-4e75-b6fd-2c4f0de6e391.json",
                                    "location": "http://localhost:8080/proxy/attachments?payload=%2Fmsr-attachments-sandbox%2Fd2c8f7e4-91ab-4e75-b6fd-2c4f0de6e391.json%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Credential%3Dminio%252F20251010%252Fus-east-1%252Fs3%252Faws4_request%26X-Amz-Date%3D20251010T121043Z%26X-Amz-Expires%3D172800%26X-Amz-SignedHeaders%3Dhost%26x-id%3DGetObject%26X-Amz-Signature%3D8911ccb55945c42c95c861f0b626ce4a5faedf9ef161bbbc6b6f2ef6164c991c"
                                },
                                {
                                    "id": "4fa83c7d-2b19-4a07-9f8e-63b36d0a1d92",
                                    "name": "snapshot.json",
                                    "type": "layout_snapshot_json",
                                    "key": "4fa83c7d-2b19-4a07-9f8e-63b36d0a1d92.json",
                                    "location": "http://localhost:8080/proxy/attachments?payload=%2Fmsr-attachments-sandbox%2F4fa83c7d-2b19-4a07-9f8e-63b36d0a1d92.json%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Credential%3Dminio%252F20251010%252Fus-east-1%252Fs3%252Faws4_request%26X-Amz-Date%3D20251010T121043Z%26X-Amz-Expires%3D172800%26X-Amz-SignedHeaders%3Dhost%26x-id%3DGetObject%26X-Amz-Signature%3Dcd389ca06244ea544e199397286f75d22ef7f385e6108a394c4b6e4a1a99cf59"
                                }
                            ]
                        },
                        {
                            "event_type": "gesture_click",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "target": "com.google.android.material.textview.MaterialTextView",
                            "target_id": "btn_bug_report",
                            "width": 1080,
                            "height": 154,
                            "x": 125,
                            "y": 1601,
                            "timestamp": "2025-05-26T11:12:50.05Z",
                            "attachments": [
                                {
                                    "id": "f3a9d7c1-62b5-4a2a-9d14-8f2bc3fbce47",
                                    "name": "snapshot.json",
                                    "type": "layout_snapshot_json",
                                    "key": "f3a9d7c1-62b5-4a2a-9d14-8f2bc3fbce47.json",
                                    "location": "http://localhost:8080/proxy/attachments?payload=%2Fmsr-attachments-sandbox%2Ff3a9d7c1-62b5-4a2a-9d14-8f2bc3fbce47.json%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Credential%3Dminio%252F20251010%252Fus-east-1%252Fs3%252Faws4_request%26X-Amz-Date%3D20251010T121043Z%26X-Amz-Expires%3D172800%26X-Amz-SignedHeaders%3Dhost%26x-id%3DGetObject%26X-Amz-Signature%3D209ae68a2cb0db7ab95fe8098df71993eab22969cd32aa0eb254e087b9444a22"
                                },
                                {
                                    "id": "8c6facd3-b962-44b4-8803-1e775ba88f91",
                                    "name": "snapshot.svg",
                                    "type": "layout_snapshot",
                                    "key": "8c6facd3-b962-44b4-8803-1e775ba88f91.svg",
                                    "location": "http://localhost:8080/proxy/attachments?payload=%2Fmsr-attachments-sandbox%2F8c6facd3-b962-44b4-8803-1e775ba88f91.svg%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Credential%3Dminio%252F20251010%252Fus-east-1%252Fs3%252Faws4_request%26X-Amz-Date%3D20251010T121043Z%26X-Amz-Expires%3D172800%26X-Amz-SignedHeaders%3Dhost%26x-id%3DGetObject%26X-Amz-Signature%3D91860caaef1688229a3b354b99ecff9411ac61a137ce7621e515013553ed3276"
                                }
                            ]
                        },
                        {
                            "bug_report_id": "f917ce21-9b8e-479d-9daa-888e32c66739",
                            "event_type": "bug_report",
                            "user_defined_attribute": {
                                "is_premium": true
                            },
                            "thread_name": "main",
                            "description": "Custom bug report",
                            "timestamp": "2025-05-26T11:12:50.069Z",
                            "attachments": [
                                {
                                    "id": "f34247a5-f0c1-4808-aa1d-c957e6214743",
                                    "name": "snapshot.svg",
                                    "type": "screenshot",
                                    "key": "f34247a5-f0c1-4808-aa1d-c957e6214743.svg",
                                    "location": "http://localhost:8080/proxy/attachments?payload=%2Fmsr-attachments-sandbox%2Ff34247a5-f0c1-4808-aa1d-c957e6214743.svg%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Credential%3Dminio%252F20251010%252Fus-east-1%252Fs3%252Faws4_request%26X-Amz-Date%3D20251010T121043Z%26X-Amz-Expires%3D172800%26X-Amz-SignedHeaders%3Dhost%26x-id%3DGetObject%26X-Amz-Signature%3D166f67162ef6a3b3654213d55263bc46c07868ec692323239fd3603213bb6c41"
                                }
                            ]
                        },
                        {
                            "event_type": "gesture_scroll",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "target": "android.widget.ScrollView",
                            "target_id": "sv_container",
                            "x": 212,
                            "y": 847,
                            "end_x": 128,
                            "end_y": 1449,
                            "direction": "down",
                            "timestamp": "2025-05-26T11:12:50.549Z",
                            "attachments": null
                        },
                        {
                            "event_type": "gesture_scroll",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "target": "android.widget.ScrollView",
                            "target_id": "sv_container",
                            "x": 275,
                            "y": 1909,
                            "end_x": 158,
                            "end_y": 1144,
                            "direction": "up",
                            "timestamp": "2025-05-26T11:12:51.291Z",
                            "attachments": null
                        },
                        {
                            "event_type": "gesture_click",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "target": "com.google.android.material.textview.MaterialTextView",
                            "target_id": "btn_generate_span",
                            "width": 1080,
                            "height": 154,
                            "x": 131,
                            "y": 1979,
                            "timestamp": "2025-05-26T11:12:52.278Z",
                            "attachments": [
                                {
                                    "id": "125df6e5-1e45-4380-bcc6-8c13e50439f8",
                                    "name": "snapshot.svg",
                                    "type": "layout_snapshot",
                                    "key": "125df6e5-1e45-4380-bcc6-8c13e50439f8.svg",
                                    "location": "http://localhost:8080/proxy/attachments?payload=%2Fmsr-attachments-sandbox%2F125df6e5-1e45-4380-bcc6-8c13e50439f8.svg%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Credential%3Dminio%252F20251010%252Fus-east-1%252Fs3%252Faws4_request%26X-Amz-Date%3D20251010T121043Z%26X-Amz-Expires%3D172800%26X-Amz-SignedHeaders%3Dhost%26x-id%3DGetObject%26X-Amz-Signature%3D32879b7cf840d3b3be16c20c179f59569b67001092a19220274e3d05fc505a21"
                                }
                            ]
                        },
                        {
                            "event_type": "gesture_scroll",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "target": "android.widget.ScrollView",
                            "target_id": "sv_container",
                            "x": 187,
                            "y": 1092,
                            "end_x": 151,
                            "end_y": 1674,
                            "direction": "down",
                            "timestamp": "2025-05-26T11:12:53.097Z",
                            "attachments": null
                        },
                        {
                            "event_type": "gesture_click",
                            "user_defined_attribute": null,
                            "thread_name": "main",
                            "target": "com.google.android.material.textview.MaterialTextView",
                            "target_id": "btn_single_exception",
                            "width": 1080,
                            "height": 154,
                            "x": 103,
                            "y": 515,
                            "timestamp": "2025-05-26T11:12:54.253Z",
                            "attachments": [
                                {
                                    "id": "0b35e832-5677-4d46-9dc8-9f1395c5d597",
                                    "name": "snapshot.svg",
                                    "type": "layout_snapshot",
                                    "key": "0b35e832-5677-4d46-9dc8-9f1395c5d597.svg",
                                    "location": "http://localhost:8080/proxy/attachments?payload=%2Fmsr-attachments-sandbox%2F0b35e832-5677-4d46-9dc8-9f1395c5d597.svg%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Credential%3Dminio%252F20251010%252Fus-east-1%252Fs3%252Faws4_request%26X-Amz-Date%3D20251010T121043Z%26X-Amz-Expires%3D172800%26X-Amz-SignedHeaders%3Dhost%26x-id%3DGetObject%26X-Amz-Signature%3D02bd2237d5d5c5d5d58d4854f545e72562fc01aac39546497539962efccaf12d"
                                }
                            ]
                        },
                        {
                            "event_type": "exception",
                            "user_defined_attribute": null,
                            "user_triggered": false,
                            "group_id": "9b71282275e88a68b38fe69a1bda0ea7",
                            "type": "java.lang.IllegalAccessException",
                            "message": "This is a new exception",
                            "method_name": "onClick",
                            "file_name": "SourceFile",
                            "line_number": 102,
                            "thread_name": "main",
                            "handled": false,
                            "stacktrace": "java.lang.IllegalAccessException: This is a new exception\n\tat L3.n.onClick(SourceFile:102)\n\tat android.view.View.performClick(View.java:7542)\n\tat android.view.View.performClickInternal(View.java:7519)\n\tat android.view.View.-$$Nest$mperformClickInternal\n\tat android.view.View$PerformClick.run(View.java:29476)\n\tat android.os.Handler.handleCallback(Handler.java:942)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7918)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalAccessException: This is a new exception\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.reflect.InvocationTargetException\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:558)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)",
                            "foreground": true,
                            "error": null,
                            "timestamp": "2025-05-26T11:12:54.266Z",
                            "attachments": [
                                {
                                    "id": "cb66672a-cbf2-4977-95e6-b7ee1302c1e9",
                                    "name": "screenshot.webp",
                                    "type": "screenshot",
                                    "key": "cb66672a-cbf2-4977-95e6-b7ee1302c1e9.webp",
                                    "location": "http://localhost:8080/proxy/attachments?payload=%2Fmsr-attachments-sandbox%2Fcb66672a-cbf2-4977-95e6-b7ee1302c1e9.webp%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Credential%3Dminio%252F20251010%252Fus-east-1%252Fs3%252Faws4_request%26X-Amz-Date%3D20251010T121043Z%26X-Amz-Expires%3D172800%26X-Amz-SignedHeaders%3Dhost%26x-id%3DGetObject%26X-Amz-Signature%3D17320dd0027d71aeb4633af471a9f2265c94024af41e670aa0da4fcfe89109a3"
                                }
                            ]
                        }
                    ]
                },
                "traces": [
                    {
                        "trace_id": "5cea4773a565f73e85002b44bfb44a30",
                        "trace_name": "activity.onCreate",
                        "thread_name": "main",
                        "start_time": "2025-05-26T11:12:43.549Z",
                        "end_time": "2025-05-26T11:12:43.59Z",
                        "duration": 41
                    },
                    {
                        "trace_id": "b6284daf4a993e8ae1695d567e998520",
                        "trace_name": "Activity TTID sh.measure.sample.ExceptionDemoActivity",
                        "thread_name": "main",
                        "start_time": "2025-05-26T11:12:43.545Z",
                        "end_time": "2025-05-26T11:12:43.672Z",
                        "duration": 127
                    },
                    {
                        "trace_id": "cc75bad89fbeae1a039b05abfd33efd8",
                        "trace_name": "SampleApp.onCreate",
                        "thread_name": "main",
                        "start_time": "2025-05-26T11:12:43.507Z",
                        "end_time": "2025-05-26T11:12:43.532Z",
                        "duration": 25
                    }
                ]
            }
        })
    ),
}))

// Update the Filters mock
jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="filters-mock">
            <button
                data-testid="update-filters"
                onClick={() =>
                    props.onFiltersChanged({
                        ready: true,
                        serialisedFilters: 'updated',
                        app: { id: 'app1', name: 'Test App' }
                    })
                }
            >
                Update Filters
            </button>
            <button
                data-testid="update-filters-2"
                onClick={() =>
                    props.onFiltersChanged({
                        ready: true,
                        serialisedFilters: 'updated2',
                        app: { id: 'app1', name: 'Test App' }
                    })
                }
            >
                Update Filters 2
            </button>
        </div>
    ),
    AppVersionsInitialSelectionType: { All: 'all' },
    defaultFilters: { ready: false, serialisedFilters: '' },
}))

// Mock ExceptionspDetailsPlot component
jest.mock('@/app/components/exceptions_details_plot', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="exceptions-details-plot-mock">ExceptionspDetailsPlot Rendered</div>
    ),
}))

// Mock ExceptionsDistributionPlot component
jest.mock('@/app/components/exceptions_distribution_plot', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="exceptions-distribution-plot-mock">ExceptionsDistributionPlot Rendered</div>
    ),
}))

// Updated Paginator mock renders Next and Prev buttons
jest.mock('@/app/components/paginator', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="paginator-mock">
            <button data-testid="prev-button" onClick={props.onPrev} disabled={!props.prevEnabled}>Prev</button>
            <button data-testid="next-button" onClick={props.onNext} disabled={!props.nextEnabled}>Next</button>
            <span>{props.displayText}</span>
        </div>
    ),
}))

// Mock LoadingSpinner component
jest.mock('@/app/components/loading_spinner', () => () => (
    <div data-testid="loading-spinner-mock">LoadingSpinner Rendered</div>
))

// Mock Accordion component
jest.mock('@/app/components/accordion', () => ({
    __esModule: true,
    Accordion: (props: { children: React.ReactNode }) => <div data-testid="accordion-mock">{props.children}</div>,
    AccordionItem: (props: { children: React.ReactNode; value: string }) => <div data-testid={`accordion-item-${props.value}`}>{props.children}</div>,
    AccordionTrigger: (props: { children: React.ReactNode }) => <div data-testid="accordion-trigger">{props.children}</div>,
    AccordionContent: (props: { children: React.ReactNode }) => <div data-testid="accordion-content">{props.children}</div>,
}))

// Mock Next.js Link component
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
        <a href={href} className={className} data-testid="mock-link">
            {children}
        </a>
    ),
}))

// Mock Image component
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt, className, width, height }: any) => (
        <img
            src={src}
            alt={alt}
            className={className}
            width={width}
            height={height}
            data-testid="mock-image"
        />
    ),
}))

// Mock CopyAiContext component
jest.mock('@/app/components/copy_ai_context', () => ({
    __esModule: true,
    default: (props: any) => (
        <button data-testid="copy-ai-context-mock">Copy AI Context</button>
    ),
}))

describe('ExceptionsDetails Component - Crashes', () => {
    beforeEach(() => {
        replaceMock.mockClear()
    })

    it('renders the app name and exceptions group name', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByText('Test App')).toBeInTheDocument()
        expect(screen.getByText('NullPointerException@MainActivity.java')).toBeInTheDocument()
    })

    it('does not render main exceptions UI when filters are not ready', () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        expect(screen.queryByTestId('exceptions-details-plot-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('exceptions-distribution-plot-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('paginator-mock')).not.toBeInTheDocument()
        expect(screen.queryByText('Stack traces')).not.toBeInTheDocument()
    })

    it('renders main exceptions UI when filters become ready and updates URL', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check URL update with limit and filters
        expect(replaceMock).toHaveBeenCalledWith('?limit=1&updated', { scroll: false })

        // Verify main UI components are rendered
        expect(screen.getByTestId('exceptions-details-plot-mock')).toBeInTheDocument()
        expect(screen.getByTestId('exceptions-distribution-plot-mock')).toBeInTheDocument()
        expect(screen.getByTestId('paginator-mock')).toBeInTheDocument()
        expect(screen.getByText('Stack traces')).toBeInTheDocument()
    })

    it('displays crash details correctly when API returns results', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Verify the exception details are displayed
        expect(screen.getByText('Id: exception1')).toBeInTheDocument()
        expect(screen.getByText('Date & time: January 1, 2020 12:00 AM')).toBeInTheDocument()
        expect(screen.getByText('Device: Google Pixel 6 Pro')).toBeInTheDocument()
        expect(screen.getByText('App version: 1.0.0')).toBeInTheDocument()
        expect(screen.getByText('Network type: WiFi')).toBeInTheDocument()

        // Check that the accordion for the crash thread is rendered
        const crashAccordion = screen.getByTestId('accordion-item-Thread: main')
        expect(crashAccordion).toBeInTheDocument()
        expect(crashAccordion).toHaveTextContent('Thread: main')
        expect(crashAccordion).toHaveTextContent(
            'java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference'
        )

        // Check that additional thread accordions are rendered
        const mainThreadAccordion = screen.getByTestId('accordion-item-main-0')
        expect(mainThreadAccordion).toBeInTheDocument()
        expect(mainThreadAccordion).toHaveTextContent('Thread: main')
        expect(mainThreadAccordion).toHaveTextContent('java.lang.Thread.sleep(Native Method)')
        expect(mainThreadAccordion).toHaveTextContent('com.example.MainActivity$1.run(MainActivity.java:52)')

        const renderThreadAccordion = screen.getByTestId('accordion-item-RenderThread-1')
        expect(renderThreadAccordion).toBeInTheDocument()
        expect(renderThreadAccordion).toHaveTextContent('Thread: RenderThread')
        expect(renderThreadAccordion).toHaveTextContent('android.view.ThreadedRenderer.nativeSyncAndDrawFrame(Native Method)')
        expect(renderThreadAccordion).toHaveTextContent('android.view.ThreadedRenderer.syncAndDrawFrame(ThreadedRenderer.java:144)')
    })

    it('shows error message when API returns error status', async () => {
        // Override the mock to return an error
        const { fetchExceptionsDetailsFromServer } = require('@/app/api/api_calls')
        fetchExceptionsDetailsFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error',
            })
        )

        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that error message is displayed
        expect(screen.getByText(/Error fetching list of crashes/)).toBeInTheDocument()
    })

    it('renders appropriate link to view the session', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the link includes the correct path
        const link = screen.getByTestId('mock-link')
        expect(link).toHaveAttribute('href', '/123/sessions/app1/session1')
        expect(link).toHaveTextContent('View Session')
    })

    it('renders attachments when available', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the attachment image is rendered
        const image = screen.getByTestId('mock-image')
        expect(image).toHaveAttribute('src', '/images/screenshot1.png')
        expect(image).toHaveAttribute('alt', 'Screenshot 0')
    })

    it('does not update URL if filters remain unchanged', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })
        expect(replaceMock).toHaveBeenCalledTimes(1)

        await act(async () => {
            fireEvent.click(updateButton)
        })
        expect(replaceMock).toHaveBeenCalledTimes(1)
    })

    describe('Pagination handling', () => {
        it('updates keyId and keyTimestamp when Next is clicked', async () => {
            render(
                <ExceptionsDetails
                    exceptionsType={ExceptionsType.Crash}
                    teamId="123"
                    appId="app1"
                    exceptionsGroupId="exception1"
                    exceptionsGroupName="NullPointerException@MainActivity.java"
                />
            )

            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })

            const nextButton = await screen.findByTestId('next-button')
            await act(async () => {
                fireEvent.click(nextButton)
            })

            // The keyId should be set to the ID of the first item in results
            expect(replaceMock).toHaveBeenLastCalledWith('?keyId=exception1&keyTimestamp=2020-01-01T00%3A00%3A00Z&limit=1&updated', { scroll: false })
        })

        it('updates keyId and keyTimestamp when Prev is clicked', async () => {
            render(
                <ExceptionsDetails
                    exceptionsType={ExceptionsType.Crash}
                    teamId="123"
                    appId="app1"
                    exceptionsGroupId="exception1"
                    exceptionsGroupName="NullPointerException@MainActivity.java"
                />
            )

            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })

            const prevButton = await screen.findByTestId('prev-button')
            await act(async () => {
                fireEvent.click(prevButton)
            })

            expect(replaceMock).toHaveBeenLastCalledWith('?keyId=exception1&keyTimestamp=2020-01-01T00%3A00%3A00Z&limit=-1&updated', { scroll: false })
        })

        it('resets pagination parameters when filters change', async () => {
            // Override useSearchParams to simulate initial parameters
            const { useSearchParams } = jest.requireActual('next/navigation')
            const useSearchParamsSpy = jest
                .spyOn(require('next/navigation'), 'useSearchParams')
                .mockReturnValue(new URLSearchParams('?keyId=previousKey&keyTimestamp=previousTs&limit=1'))

            render(
                <ExceptionsDetails
                    exceptionsType={ExceptionsType.Crash}
                    teamId="123"
                    appId="app1"
                    exceptionsGroupId="exception1"
                    exceptionsGroupName="NullPointerException@MainActivity.java"
                />
            )

            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            expect(replaceMock).toHaveBeenCalledWith('?keyId=previousKey&keyTimestamp=previousTs&limit=1&updated', { scroll: false })

            // Now simulate a filter change with a different value
            const updateButton2 = screen.getByTestId('update-filters-2')
            await act(async () => {
                fireEvent.click(updateButton2)
            })

            // Should keep the keyId and keyTimestamp from URL
            expect(replaceMock).toHaveBeenLastCalledWith('?keyId=previousKey&keyTimestamp=previousTs&limit=1&updated2', { scroll: false })
            useSearchParamsSpy.mockRestore()
        })
    })

    it('correctly displays and hides loading spinner based on API status', async () => {
        // Mock implementation to control loading state
        const { fetchExceptionsDetailsFromServer } = require('@/app/api/api_calls')

        // Create a promise that won't resolve immediately to maintain loading state
        let resolvePromise: (value: any) => void
        const loadingPromise = new Promise(resolve => {
            resolvePromise = resolve
        })

        fetchExceptionsDetailsFromServer.mockImplementationOnce(() => loadingPromise)

        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Test the loading state - loading spinner should be visible
        expect(screen.getByTestId('loading-spinner-mock')).toBeInTheDocument()
        expect(screen.queryByText('Id: exception1')).not.toBeInTheDocument()

        // Resolve the loading promise to move to success state
        await act(async () => {
            resolvePromise({
                status: 'success',
                data: {
                    results: [
                        {
                            id: 'exception1',
                            session_id: 'session1',
                            timestamp: '2020-01-01T00:00:00Z',
                            type: 'NullPointerException',
                            thread_name: 'main',
                            attribute: {
                                device_manufacturer: 'Google ',
                                device_model: '6 Pro',
                                app_version: '1.0.0',
                                network_type: 'WiFi'
                            },
                            exception: {
                                title: 'NullPointerException',
                                stacktrace: 'java.lang.NullPointerException'
                            },
                            threads: [],
                            attachments: []
                        }
                    ],
                    meta: { previous: false, next: false },
                }
            })
        })

        // After loading, the details should be visible and loading spinner should be gone
        await screen.findByText('Id: exception1')
        expect(screen.queryByTestId('loading-spinner-mock')).not.toBeInTheDocument()
    })
})

describe('ExceptionsDetails Component - ANRs', () => {
    beforeEach(() => {
        replaceMock.mockClear()
    })

    it('renders ANR thread correctly instead of crash thread', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Anr}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="ANR@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the ANR accordion is rendered instead of crash accordion
        const anrAccordion = screen.getByTestId('accordion-item-Thread: main')
        expect(anrAccordion).toBeInTheDocument()
        expect(anrAccordion).toHaveTextContent('Thread: main')
        expect(anrAccordion).toHaveTextContent('ANR in com.example.MainActivity')
    })

    it('shows error message with ANR-specific text', async () => {
        // Override the mock to return an error
        const { fetchExceptionsDetailsFromServer } = require('@/app/api/api_calls')
        fetchExceptionsDetailsFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error',
            })
        )

        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Anr}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="ANR@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByText(/Error fetching list of ANRs/)).toBeInTheDocument()
    })

    it('displays proper plots when filters are ready', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Anr}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="ANR@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByTestId('exceptions-details-plot-mock')).toBeInTheDocument()
        expect(screen.getByTestId('exceptions-distribution-plot-mock')).toBeInTheDocument()
    })

    it('correctly initializes with empty state for ANR type', async () => {
        const { fetchExceptionsDetailsFromServer } = require('@/app/api/api_calls')
        fetchExceptionsDetailsFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success',
                data: {
                    results: [],
                    meta: { previous: false, next: false },
                }
            })
        )

        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Anr}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="ANR@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Should not display any exception details when no results
        expect(screen.queryByText(/Id:/)).not.toBeInTheDocument()
        expect(screen.queryByTestId('accordion-anr')).not.toBeInTheDocument()
    })

    it('shows the CopyAiContext button', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Anr}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="ANR@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByTestId('copy-ai-context-mock')).toBeInTheDocument()
    })
})