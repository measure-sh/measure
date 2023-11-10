# SDK REST API Documentation <!-- omit in toc -->

Find all the endpoints, resources and detailed documentation for Measure SDK REST APIs.

## Contents <!-- omit in toc -->

- [Resources](#resources)
  - [PUT `/sessions`](#put-sessions)
    - [Usage Notes](#usage-notes)
    - [Authorization \& Content Type](#authorization--content-type)
    - [Response Body](#response-body)
    - [Request Body](#request-body)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting)
  - [PUT `/mappings`](#put-mappings)
    - [Usage Notes](#usage-notes-1)
    - [Authorization \& Content Type](#authorization--content-type-1)
    - [Response Body](#response-body-1)
    - [Request Body](#request-body-1)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-1)
- [References](#references)
  - [Session](#session)
  - [Resource](#resource)
  - [Attachments](#attachments)
  - [Events](#events)
  - [Event Types](#event-types)
    - [**`anr`**](#anr)
    - [**`exception`**](#exception)
    - [**`string`**](#string)
    - [**`gesture_long_click`**](#gesture_long_click)
    - [**`gesture_scroll`**](#gesture_scroll)
    - [**`gesture_click`**](#gesture_click)
    - [**`http_request`**](#http_request)
    - [**`http_response`**](#http_response)
    - [**`app_exit`**](#app_exit)
    - [**`lifecycle_activity`**](#lifecycle_activity)
    - [**`lifecycle_fragment`**](#lifecycle_fragment)
    - [**`lifecycle_app`**](#lifecycle_app)
    - [**`cold_launch`**](#cold_launch)

## Resources

- [**PUT `/sessions`**](#put-sessions) - Send entire log of a session containing all events, attachments, metrics and traces via this unified endpoint.

### PUT `/sessions`

Ingests everything that was captured in a single Measure session. Broadly, these are:

- **Resource** - various device properties like device name, screen dimensions
- **Events** (optional) - text logs, interactive gestures, network request/response pairs, exceptions
- **Attachments** (optional) - screenshots, system traces
- _Metrics_ (optional) - _coming soon_
- _Traces_ (optional)- _coming soon_

#### Usage Notes

- Each session must contain a unique UUIDv4 id.
- Each event must contain a nanosecond precision `timestamp` - `"2023-08-24T14:51:38.000000534Z"`
- Each session must contain a `resource` field containing various device characteristics.
- Multiple events must be sent in the `events` array field. They must be one of the valid types, like `string`, `gesture_long_click` and so on.
- Each event can contain upto **10** arbitrary key/value pairs called `Attributes`
- Successful response returns `202 Accepted`.
- Idempotent. Previously seen sessions matching by `session_id` won't be re-processed.

#### Authorization & Content Type

1. Set the Measure API key in `Authorization: Bearer <api-key>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                       |
| --------------- | ------------------------------- |
| `Authorization` | Bearer &lt;measure-api-key&gt;  |
| `Content-Type`  | application/json; charset=utf-8 |
</details>

#### Response Body

- For new sessions

  ```json
  {
    "ok": "accepted"
  }
  ```

- For already seen sessions

  ```json
  {
    "ok": "accepted, known session"
  }
  ```

  > ⚠ **Note**
  >
  > A success response of `202 Accepted` means the server has accepted the session, but it may choose to not process & discard some events, metrics, traces and attachments depending on various conditions.

- Failed requests have the following response shape

  ```json
  {
    "error": "error message appears here"
  }
  ```

#### Request Body

To understand the shape of the JSON payload, take a look at this sample request. You'll find detailed reference of `resource`, `events` &amp; `attachments` shapes below.

**Example payload**

<details>
<summary>Expand</summary>

```json
{
  "session_id": "633a2fbc-a0d1-4912-a92f-9e43e72afbc6",
  "timestamp": "2023-08-24T14:51:38.000000534Z",
  "resource": {
    "device_name": "sunfish",
    "device_model": "SM-G950F",
    "device_manufacturer": "samsung",
    "device_type": "phone",
    "device_is_foldable": true,
    "device_is_physical": false,
    "device_density_dpi": 100,
    "device_width_px": 480,
    "device_height_px": 800,
    "device_density": 2,
    "os_name": "android",
    "os_version": "31",
    "platform": "android",
    "app_version": "1.0.1",
    "app_build": "576358",
    "app_unique_id": "com.example.app",
    "measure_sdk_version": "0.0.1"
  },
  "events": [
    {
      "timestamp": "2023-08-24T14:51:39.000000534Z",
      "type": "string",
      "string": {
        "severity_text": "INFO",
        "string": "This is a log from the Android logcat"
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
      "timestamp": "2023-08-24T14:51:40.000000534Z",
      "type": "gesture_long_click",
      "gesture_long_click": {
        "target": "some_target_name",
        "target_user_readable_name": "some user readable name",
        "target_id": "some-target-id",
        "touch_down_time": "2023-09-02T07:14:22Z",
        "touch_up_time": "2023-09-02T07:14:47Z",
        "width": 1440,
        "height": 996,
        "x": 1234,
        "y": 340
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
      "timestamp": "2023-08-24T14:51:41.000000534Z",
      "type": "gesture_scroll",
      "gesture_scroll": {
        "target": "some-scroll-target",
        "target_user_readable_name": "user readable scroll name",
        "target_id": "scroll-target-id",
        "touch_down_time": "2023-09-02T07:14:22Z",
        "touch_up_time": "2023-09-02T07:14:47Z",
        "x": 1234,
        "y": 340,
        "end_x": 1330,
        "end_y": 370,
        "velocity_px": 123,
        "direction": 78
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
      "type": "gesture_click",
      "gesture_click": {
        "target": "some-click-target",
        "target_user_readable_name": "user readable click name",
        "target_id": "click-target-id",
        "touch_down_time": "2023-09-02T07:14:22Z",
        "touch_up_time": "2023-09-02T07:14:47Z",
        "width": 1440,
        "height": 996,
        "x": 1234,
        "y": 340
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
      "type": "http_request",
      "http_request": {
        "request_id": "ffcf24b6-7cea-4fac-a2bf-131321843ccc",
        "request_url": "https://example.com/foo/bar/baz",
        "method": "GET",
        "http_protocol_version": "1.1",
        "request_body_size": 1024,
        "request_body": "bla bla bla",
        "request_headers": {
          "content-type": "application/json",
          "authorization": "bearer some-secret-here"
        }
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
      "type": "http_response",
      "http_response": {
        "request_id": "ffcf24b6-7cea-4fac-a2bf-131321843ccc",
        "request_url": "https://example.com/foo/bar/baz",
        "method": "GET",
        "latency_ms": 220,
        "status_code": 200,
        "http_protocol_version": "1.1",
        "response_body": "{foo: \"bar\"}",
        "response_headers": {
          "content-type": "application/json"
        }
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
      "timestamp": "2023-08-24T14:51:41.000000534Z",
      "type": "exception",
      "exception": {
        "thread_name": "main",
        "handled": false,
        "exceptions": [
          {
            "type": "java.lang.RuntimeException",
            "message": "java.lang.reflect.InvocationTargetException",
            "frames": [
              {
                "line_num": 558,
                "col_num": 558,
                "module_name": "com.android.internal.osRuntimeInit$MethodAndArgsCaller",
                "file_name": "RuntimeInit.java",
                "class_name": "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
                "method_name": "run"
              },
              {
                "line_num": 936,
                "col_num": 558,
                "module_name": "com.android.internal.osRuntimeInit$MethodAndArgsCaller",
                "file_name": "ZygoteInit.java",
                "class_name": "com.android.internal.os.ZygoteInit",
                "method_name": "main"
              }
            ]
          }
        ],
        "threads": [
          {
            "name": "measure-thread-pool-09",
            "frames": [
              {
                "line_num": -2,
                "col_num": 158,
                "module_name": "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
                "file_name": "VMStack.java",
                "class_name": "dalvik.system.VMStack",
                "method_name": "getThreadStackTrace"
              }
            ]
          }
        ]
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    }
  ],
  "attachments": [
    {
      "name": "attachment-1.png",
      "type" "screenshot",
      "extension": "png",
      "blob": "iVBORw0KGgoAAAANSUhEUgAABDkAAAkkCAYAAAAWEaSRAAAAAX..."
    },
    {
      "name": "attachment-2.png",
      "type" "screenshot",
      "extension": "png",
      "blob": "iVBORw0KGgoAAAANSUhEUgAABDkAAAkkCAYAAAAWEaSRAAAAAX..."
    }
  ]
}
```

</details>

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `202 Accepted`              | Request was accepted and will be processed                                                                              |
| `400 Bad Request`           | Request body is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the Measure API key is not present or has expired.                                                               |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                              |

</details>

### PUT `/mappings`

Measure will use files uploaded via this API for symbolication of class, method, file names.

#### Usage Notes

- File size should not exceed **512 MiB**
- Uploading a previously uploaded file with same contents for the same `app_unique_id`, `version_name` & `version_code` combination replaces the older file.

#### Authorization \& Content Type

1. Set the Measure API key in `Authorization: Bearer <api-key>` format

2. Set the content type as `Content-Type: multipart/form-data;boundary="<boundary>"` with a suitable boundary.

3. Value of `<boundary>` can be anything, but make sure the value doesn't change in the same request.

#### Response Body

- For an unseen mapping file

  ```json
  {
    "ok": "uploaded mapping file: <filename.extension>"
  }
  ```

#### Request Body

Payload must be a `multipart/form-data` each field separated using `Content-Disposition` fields. Typically, you would use the facilities provided by your programming language's standard library or other third party request libraries to issue such requests.

**Example payload**

<details>
<summary>Expand</summary>

```
--boundary
Content-Disposition: form-data; name="app_unique_id"

sh.measure.sample
--boundary
Content-Disposition: form-data; name="version_name"

1.0
--boundary
Content-Disposition: form-data; name="version_code"

1
--boundary
Content-Disposition: form-data; name="type"

proguard
--boundary
Content-Disposition: form-data; name="mapping_file"; filename="mapping-file.txt"

<...mapping file bytes...>
```

</details>

#### Status Codes \& Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Mapping file got uploaded                                                                                               |
| `400 Bad Request`           | Request body is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the Measure API key is not present or has expired.                                                               |
| `413 Content Too Large`     | Mapping file size exceeded maximum allowed limit.                                                                       |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                              |

</details>

## References 

Exhaustive list of all JSON fields.

### Session

The top-level Session object has the following properties.

```json
{
  "session_id": "",
  "timestamp": "",
  "resource": {},
  "events": [],
  "attachments": []
}
```

| Field        | Type   | Optional | Comment                                                   |
| ------------ | ------ | -------- | --------------------------------------------------------- |
| `session_id` | string | No       | UUIDv4 string                                             |
| `timestamp`  | string | No       | Nanosecond precision timestamp in ISO 8601 format         |
| `resource`   | object | No       | Resource object. See below.                               |
| `events`     | array  | No       | Events array containing various event objects. See below. |

### Resource

Resource object has the following properties.

| Field                 | Type    | Optional | Comment                         |
| --------------------- | ------- | -------- | ------------------------------- |
| `device_name`         | string  | Yes      | Name of the device              |
| `device_model`        | string  | Yes      | Device model                    |
| `device_manufacturer` | string  | Yes      | Name of the device manufacturer |
| `device_type`         | string  | Yes      | `phone` or `tablet`             |
| `device_is_foldable`  | boolean | Yes      | `true` for foldable devices     |
| `device_is_physical`  | boolean | Yes      | `true` for physical devices     |
| `device_density_dpi`  | number  | Yes      | DPI density                     |
| `device_width_px`     | number  | Yes      | Screen width                    |
| `device_height_px`    | number  | Yes      | Screen height                   |
| `device_density`      | number  | Yes      | Device model                    |
| `os_name`             | string  | Yes      | Operating system name           |
| `os_version`          | string  | Yes      | Operating system version        |
| `app_version`         | string  | Yes      | App version identifier          |
| `app_build`           | string  | Yes      | App build identifier            |
| `app_unique_id`       | string  | Yes      | App bundle identifier           |
| `measure_sdk_version` | string  | Yes      | Measure SDK version identifier  |

### Attachments

Attachments are arbitrary files associated with the session each having the following properties.

| Field       | Type   | Optional | Comment                                                                 |
| ----------- | ------ | -------- | ----------------------------------------------------------------------- |
| `name`      | string | No       | name of the attachment                                                  |
| `type`      | string | No       | One of the following:<br />- `screenshot`<br />- `android_method_trace` |
| `extension` | string | Yes      | Extension of the file, like png, jpeg, atrace etc                       |
| `timestamp` | string | No       | ISO 8601 timestamp at the of attachment's creation                      |
| `blob`      | string | Yes      | Bytes of the file base64 encoded                                        |

### Events

Event objects have the following fields. Additionally, each object must contain one of the event types of the same name.

```json
{
  "timestamp": "",
  "type": "",
  "thread_name": "",
  "attributes": {}
}
```

| Field         | Type   | Optional | Comment                                                                                                    |
| ------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------- |
| `timestamp`   | string | No       | Nanosecond precision timestamp                                                                             |
| `type`        | string | No       | Device model                                                                                               |
| `thread_name` | string | No       | Name of the thread                                                                                         |
| `attributes`  | object | Yes      | Additional arbitrary metadata. All values must be of `string` type. Cannot contain more than **10** items. |

### Event Types

Each event object must be of one of the following types. Refer to the sample payload above to understand the shape of each object.

#### **`anr`**

Use the `anr` type for [Application Not Responding](https://developer.android.com/topic/performance/vitals/anr) events. 

| Field         | Type    | Optional | Comment                                               |
| ------------- | ------- | -------- | ----------------------------------------------------- |
| `thread_name` | string  | Yes      | Name of the thread                                    |
| `handled`     | boolean | No       | `false` for crashes, `true` if exceptions are handled |
| `exceptions`  | array   | No       | Array of exception objects                            |
| `threads`     | array   | Yes      | Array of thread objects                               |

`exception` objects

Each exception object contains further fields.

| Field     | Type   | Optional | Comment                     |
| --------- | ------ | -------- | --------------------------- |
| `type`    | string | No       | Type of the exception       |
| `message` | string | No       | Error message text          |
| `frames`  | array  | Yes      | Array of stackframe objects |

`thread` objects

Each thread object contains further fields.

| Field    | Type   | Optional | Comment                     |
| -------- | ------ | -------- | --------------------------- |
| `name`   | string | Yes      | Name of thread              |
| `frames` | array  | Yes      | Array of stackframe objects |

`frame` objects

Each frame object contains further fields.

| Field         | Type   | Optional | Comment                        |
| ------------- | ------ | -------- | ------------------------------ |
| `line_num`    | number | Yes      | Line number of the method      |
| `col_num`     | number | Yes      | Column number of the method    |
| `module_name` | string | Yes      | Name of the originating module |
| `file_name`   | string | Yes      | Name of the originating file   |
| `class_name`  | string | Yes      | Name of the originating class  |
| `method_name` | string | Yes      | Name of the originating method |

#### **`exception`**

Use the `exception` type for errors and crashes. 

| Field         | Type    | Optional | Comment                                               |
| ------------- | ------- | -------- | ----------------------------------------------------- |
| `thread_name` | string  | Yes      | Name of the thread                                    |
| `handled`     | boolean | No       | `false` for crashes, `true` if exceptions are handled |
| `exceptions`  | array   | No       | Array of exception objects                            |
| `threads`     | array   | Yes      | Array of thread objects                               |

`exception` objects

Each exception object contains further fields.

| Field     | Type   | Optional | Comment                     |
| --------- | ------ | -------- | --------------------------- |
| `type`    | string | No       | Type of the exception       |
| `message` | string | No       | Error message text          |
| `frames`  | array  | Yes      | Array of stackframe objects |

`thread` objects

Each thread object contains further fields.

| Field    | Type   | Optional | Comment                     |
| -------- | ------ | -------- | --------------------------- |
| `name`   | string | Yes      | Name of thread              |
| `frames` | array  | Yes      | Array of stackframe objects |

`frame` objects

Each frame object contains further fields.

| Field         | Type   | Optional | Comment                        |
| ------------- | ------ | -------- | ------------------------------ |
| `line_num`    | number | Yes      | Line number of the method      |
| `col_num`     | number | Yes      | Column number of the method    |
| `module_name` | string | Yes      | Name of the originating module |
| `file_name`   | string | Yes      | Name of the originating file   |
| `class_name`  | string | Yes      | Name of the originating class  |
| `method_name` | string | Yes      | Name of the originating method |

#### **`string`**

Use the `string` type when sending unstructured or structured logs. Make sure structured logs are in stringified JSON format.

| Field           | Type   | Optional | Comment                                                        |
| --------------- | ------ | -------- | -------------------------------------------------------------- |
| `severity_text` | string | Yes      | Log level. One of `info`, `warning`, `error`, `fatal`, `debug` |
| `string`        | string | No       | Log message text                                               |

#### **`gesture_long_click`**

Use the `gesture_long_click` body type for longer press and hold gestures.

| Field                       | Type   | Optional | Comment                                     |
| --------------------------- | ------ | -------- | ------------------------------------------- |
| `target`                    | string | Yes      | Class/Instance name of the originating view |
| `target_user_readable_name` | string | Yes      | Contextual name of the target view          |
| `target_id`                 | string | Yes      | Unique identifier for the target            |
| `touch_down_time`           | string | Yes      | ISO 8601 timestamp when target was pressed  |
| `touch_up_time`             | string | Yes      | ISO 8601 timestamp when target was released |
| `width`                     | number | Yes      | Width of the target view in pixels          |
| `height`                    | number | Yes      | Height of the target view in pixels         |
| `x`                         | number | No       | X coordinate of the target view             |
| `y`                         | number | No       | Y coordinate of the target view             |

#### **`gesture_scroll`**

Use the `gesture_scroll` body type for scroll events.

| Field                       | Type   | Optional | Comment                                           |
| --------------------------- | ------ | -------- | ------------------------------------------------- |
| `target`                    | string | Yes      | Class/Instance name of the originating view       |
| `target_user_readable_name` | string | Yes      | Contextual name of the target view                |
| `target_id`                 | string | Yes      | Unique identifier for the target                  |
| `touch_down_time`           | string | Yes      | ISO 8601 start timestamp when target was scrolled |
| `touch_up_time`             | string | Yes      | ISO 8601 end timestamp when target scroll ended   |
| `x`                         | number | No       | X coordinate of the target where scroll started   |
| `y`                         | number | No       | Y coordinate of the target where scroll started   |
| `end_x`                     | number | No       | X coordinate of the target where scroll ended     |
| `end_y`                     | number | No       | Y coordinate of the target where scroll ended     |
| `velocity_px`               | number | Yes      | Velocity at the time of scroll release            |
| `direction`                 | number | Yes      | Angle at which the scroll took place              |

#### **`gesture_click`**

Use the `gesture_click` body type for taps or clicks.

| Field                       | Type   | Optional | Comment                                         |
| --------------------------- | ------ | -------- | ----------------------------------------------- |
| `target`                    | string | Yes      | Class/Instance name of the originating view     |
| `target_user_readable_name` | string | Yes      | Contextual name of the target view              |
| `target_id`                 | string | Yes      | Unique identifier for the target                |
| `touch_down_time`           | string | Yes      | ISO 8601 timestamp when target was pressed      |
| `touch_up_time`             | string | Yes      | ISO 8601 timestamp when target was released     |
| `width`                     | number | Yes      | Width of the target view in pixels              |
| `height`                    | number | Yes      | Height of the target view in pixels             |
| `x`                         | number | No       | X coordinate of the target where click happened |
| `y`                         | number | No       | Y coordinate of the target where click happened |

#### **`http_request`**

Use the `http_request` body type for HTTP requests.

| Field                   | Type   | Optional | Comment                                                  |
| ----------------------- | ------ | -------- | -------------------------------------------------------- |
| `request_id`            | string | No       | UUIDv4 id of the HTTP request                            |
| `request_url`           | string | No       | Complete URL of the HTTP request                         |
| `method`                | string | No       | Any of the common HTTP method like, `GET` or `POST`      |
| `http_protocol_version` | string | Yes      | Version of the HTTP protocol. `1.0`, `1.1`, `2` etc      |
| `request_body_size`     | number | Yes      | Size of the HTTP request body in bytes                   |
| `request_body`          | string | Yes      | Body of the HTTP request                                 |
| `request_headers`       | object | Yes      | Headers of the HTTP request. All values must be strings. |

#### **`http_response`**

Use the `http_response` body type for HTTP responses.

| Field              | Type   | Optional | Comment                                                             |
| ------------------ | ------ | -------- | ------------------------------------------------------------------- |
| `request_id`       | string | No       | UUIDv4 id of the request                                            |
| `request_url`      | string | No       | Complete URL of the request                                         |
| `method`           | string | No       | Any of the common HTTP method like, `GET` or `POST`                 |
| `latency_ms`       | number | No       | Time in milliseconds taken from request start to last byte received |
| `status_code`      | number | Yes      | HTTP response status code                                           |
| `response_body`    | string | Yes      | Body of the response                                                |
| `response_headers` | object | Yes      | Headers of the HTTP response. All values must be strings.           |

#### **`app_exit`**

Use the `app_exit` type for Application Exit events.

| Field          | Type   | Optional | Comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reason`       | string | No       | One of the following:<br />- `REASON_ANR`<br />- `REASON_CRASH`<br />- `REASON_CRASH_NATIVE`<br />- `REASON_DEPENDENCY_DIED`<br />- `REASON_EXCESSIVE_RESOURCE_USAGE`<br />- `REASON_EXIT_SELF`<br />- `REASON_FREEZER`<br />- `REASON_INITIALIZATION_FAILURE`<br />- `REASON_LOW_MEMORY`<br />- `REASON_OTHER`<br />- `REASON_PACKAGE_STATE_CHANGE`<br />- `REASON_PACKAGE_UPDATED`<br />- `REASON_PERMISSION_CHANGE`<br />- `REASON_SIGNALED`<br />- `REASON_UNKNOWN`<br />- `REASON_USER_REQUESTED`<br />- `REASON_USER_STOPPED` |
| `importance`   | string | No       | Importance of the process that it used to have before death<br />- `IMPORTANCE_FOREGROUND`<br />- `IMPORTANCE_FOREGROUND_SERVICE`<br />- `IMPORTANCE_TOP_SLEEPING`<br />- `IMPORTANCE_VISIBLE`<br />- `IMPORTANCE_PERCEPTIBLE`<br />- `IMPORTANCE_CANT_SAVE_STATE`<br />- `IMPORTANCE_SERVICE`<br />- `IMPORTANCE_CACHED`<br />- `IMPORTANCE_GONE`                                                                                                                                                                                  |
| `trace`        | string | Yes      | Modified trace given by ApplicationExitInfo to help debug ANRs. Must be only set for session that had an ANR.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `process_name` | number | No       | Name of the process                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pid`          | number | Yes      | ID of the process that died                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `timestamp`    | string | Yes      | Unix epoch timestamp of the process's death, in milliseconds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

#### **`lifecycle_activity`**

Use the `lifecycle_activity` type for Android's activity lifecycle events

| Field                  | Type    | Optional | Comment                                                                                                            |
| ---------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `type`                 | string  | No       | One of the following:<br />- `created`<br />- `resumed`<br />- `paused`<br />- `destroyed`                         |
| `class_name`           | string  | No       | Activity's fully qualified class name                                                                              |
| `intent`               | string  | Yes      | [Intent](https://developer.android.com/reference/android/content/Intent#getDataString()) data serialized as string |
| `saved_instance_state` | boolean | Yes      | `true` if activity was created with a saved state. Only applies when type is `created`.                            |

#### **`lifecycle_fragment`**

Use the `lifecycle_fragment` type for Android's fragment lifecycle events.

| Field             | Type   | Optional | Comment                                                                                    |
| ----------------- | ------ | -------- | ------------------------------------------------------------------------------------------ |
| `type`            | string | No       | One of the following:<br />- `attached`<br />- `resumed`<br />- `paused`<br />- `detached` |
| `class_name`      | string | No       | Fragment's fully qualified class name                                                      |
| `parent_activity` | string | Yes      | Fragment's parent activity's fully qualified class name                                    |
| `tag`             | string | Yes      | [Fragment's Tag](https://developer.android.com/reference/android/app/Fragment#getTag())    |

#### **`lifecycle_app`**

Use the `lifecycle_app` type for Android's app lifecycle events.

| Field  | Type   | Optional | Comment                                                       |
| ------ | ------ | -------- | ------------------------------------------------------------- |
| `type` | string | No       | One of the following:<br />- `background`<br />- `foreground` |

#### **`cold_launch`**

Use the `cold_launch` type for HTTP responses.

| Field                           | Type    | Optional | Comment                                                                            |
| ------------------------------- | ------- | -------- | ---------------------------------------------------------------------------------- |
| `start_uptime`                  | number  | No       | Uptime in msec when user most likely started waiting for app to launch             |
| `end_uptime`                    | number  | No       | Uptime in msec when user likely sees the first meaningful content on screen        |
| `eu_is_first_draw`              | boolean | No       | Mechanism of `end_uptime` calculation                                              |
| `su_is_process_start_requested` | boolean | No       | Mechanism of `start_uptime` calculation                                            |
| `su_is_content_provider_init`   | boolean | No       | Mechanism of `start_uptime` calculation                                            |
| `su_is_process_start_uptime`    | boolean | No       | Mechanism of `start_uptime` calculation                                            |
| `first_visible_activity`        | string  | No       | Name of the first visible activity                                                 |
| `duration`                      | number  | No       | Time taken for app to launch in msec. Calculated as `end_uptime` - `start_uptime`. |
| `intent`                        | string  | Yes      | Intent data with which the `first_visible_activity` was launched                   |
