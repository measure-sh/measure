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
  - [PUT `/builds`](#put-builds)
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
    - [**`http`**](#http)
    - [**`app_exit`**](#app_exit)
    - [**`lifecycle_activity`**](#lifecycle_activity)
    - [**`lifecycle_fragment`**](#lifecycle_fragment)
    - [**`lifecycle_app`**](#lifecycle_app)
    - [**`cold_launch`**](#cold_launch)
    - [**`warm_launch`**](#warm_launch)
    - [**`hot_launch`**](#hot_launch)
    - [**`cpu_usage`**](#cpu_usage)
    - [**`memory_usage`**](#memory_usage)
    - [**`low_memory`**](#low_memory)
    - [**`trim_memory`**](#trim_memory)
    - [**`navigation`**](#navigation)

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
    "network_type": "cellular",
    "network_provider": "airtel",
    "network_generation": "4g",
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
      "type": "http",
      "http": {
        "client": "okhttp",
        "connect_end": 4403805,
        "connect_start": 4400915,
        "dns_end": 4400915,
        "dns_start": 4400911,
        "end_time": 4404308,
        "failure_description": null,
        "failure_reason": null,
        "method": "get",
        "request_body_end": null,
        "request_body_size": null,
        "request_body_start": null,
        "request_end": 4403816,
        "request_headers": {
          "accept": "application/json; charset=utf-8;",
          "accept-encoding": "gzip",
          "accept-language": "en",
          "connection": "Keep-Alive",
          "host": "www.example.com",
        },
        "request_headers_end": 4403816,
        "request_headers_size": 567,
        "request_headers_start": 4403807,
        "request_start": 4403807,
        "request_timestamp": "2024-01-01T08:10:08.19800000Z",
        "response_body_end": 4404284,
        "response_body_size": 0,
        "response_body_start": 4404284,
        "response_end": 4404284,
        "response_headers": {
          "x-frame-options": "SAMEORIGIN",
          "x-xss-protection": "1; mode=block"
        },
        "response_headers_end": 4404283,
        "response_headers_size": 1445,
        "response_headers_start": 4404275,
        "response_start": 4404275,
        "response_timestamp": "2024-01-01T08:10:11.65600000Z",
        "start_time": 4400851,
        "status_code": 304,
        "url": "https://www.example.com/api/rest_v1/xyz/2024/01/01"
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },`
    {
      "timestamp": "2023-08-24T14:51:41.000000534Z",
      "type": "exception",
      "exception": {
        "thread_name": "main",
        "handled": false,
        "foreground": true,
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

### PUT `/builds`

Measure will use build information like mapping files, build sizes uploaded via this API for deobfuscation and to track app size changes.

#### Usage Notes

- Mapping file size should not exceed **512 MiB**.
- `mapping_type` &amp; `mapping_file` are optional. Both need to be present for mapping file upload to work.
- `version_name`, `version_code`, `build_size` &amp; `build_type` are required and cannot be skipped.
- Uploading a previously uploaded file with same contents for the same `version_name`, `version_code`, `mapping_type` combination replaces the older file.
- Putting `build_size` for the same `version_name`, `version_code` and `build_type` combination replaces the last size with the latest size.

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
Content-Disposition: form-data; name="version_name"

1.0
--boundary
Content-Disposition: form-data; name="version_code"

1
--boundary
Content-Disposition: form-data; name="mapping_file"; filename="mapping-file.txt"

<...mapping file bytes...>
--boundary
Content-Disposition: form-data; name="mapping_type"

proguard
--boundary
Content-Disposition: form-data; name="build_size"

10241024
--boundary
Content-Disposition: form-data; name="build_type"

aab
```

</details>

#### Status Codes \& Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Build info uploaded                                                                                             |
| `400 Bad Request`           | Request body is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the Measure API key is not present or has expired.                                                               |
| `413 Content Too Large`     | Build/mapping file size exceeded maximum allowed limit.                                                                       |
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

| Field                  | Type    | Optional | Comment                                                                   |
|------------------------|---------|----------|---------------------------------------------------------------------------|
| `device_name`          | string  | Yes      | Name of the device                                                        |
| `device_model`         | string  | Yes      | Device model                                                              |
| `device_manufacturer`  | string  | Yes      | Name of the device manufacturer                                           |
| `device_type`          | string  | Yes      | `phone` or `tablet`                                                       |
| `device_is_foldable`   | boolean | Yes      | `true` for foldable devices                                               |
| `device_is_physical`   | boolean | Yes      | `true` for physical devices                                               |
| `device_density_dpi`   | number  | Yes      | DPI density                                                               |
| `device_width_px`      | number  | Yes      | Screen width                                                              |
| `device_height_px`     | number  | Yes      | Screen height                                                             |
| `device_density`       | number  | Yes      | Device model                                                              |
| `device_locale`        | string  | Yes      | Locale based on RFC 5646, eg. en-US                                       |
| `os_name`              | string  | Yes      | Operating system name                                                     |
| `os_version`           | string  | Yes      | Operating system version                                                  |
| `app_version`          | string  | Yes      | App version identifier                                                    |
| `app_build`            | string  | Yes      | App build identifier                                                      |
| `app_unique_id`        | string  | Yes      | App bundle identifier                                                     |
| `network_type`         | string  | Yes      | One of<br/>- wifi<br/>- cellular<br/>- vpn<br/>- unknown<br/>- no_network |
| `network_provider`     | string  | Yes      | Example: airtel, T-mobile                                                 |
| `network_generation`   | string  | Yes      | One of:<br/>- 2g<br/>- 3g<br/>- 4g<br/>- 5g                               |
| `measure_sdk_version`  | string  | Yes      | Measure SDK version identifier                                            |

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

| Field                | Type    | Optional | Comment                                                                                                            |
|----------------------|---------|----------|--------------------------------------------------------------------------------------------------------------------|
| `thread_name`        | string  | Yes      | Name of the thread                                                                                                 |
| `handled`            | boolean | No       | `false` for crashes, `true` if exceptions are handled                                                              |
| `exceptions`         | array   | No       | Array of exception objects                                                                                         |
| `network_type`       | string  | Yes      | The network type at the time of the ANR. One of<br/>- wifi<br/>- cellular<br/>- vpn<br/>- unknown<br/>- no_network |
| `network_provider`   | string  | Yes      | The network provider at the time of the ANR. Example: airtel, T-mobile                                             |
| `network_generation` | string  | Yes      | The network generation at the time of the ANR. One of:<br/>- 2g<br/>- 3g<br/>- 4g<br/>- 5g                         |
| `device_locale`      | string  | Yes      | Locale based on RFC 5646, eg. en-US                                                                                |
| `threads`            | array   | Yes      | Array of thread objects                                                                                            |

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

| Field                | Type    | Optional | Comment                                                                                                                  |
|----------------------|---------|----------|--------------------------------------------------------------------------------------------------------------------------|
| `thread_name`        | string  | Yes      | Name of the thread                                                                                                       |
| `handled`            | boolean | No       | `false` for crashes, `true` if exceptions are handled                                                                    |
| `exceptions`         | array   | No       | Array of exception objects                                                                                               |
| `network_type`       | string  | Yes      | The network type at the time of the Exception. One of<br/>- wifi<br/>- cellular<br/>- vpn<br/>- unknown<br/>- no_network |
| `network_provider`   | string  | Yes      | The network provider at the time of the Exception. Example: airtel, T-mobile                                             |
| `network_generation` | string  | Yes      | The network generation at the time of the Exception. One of:<br/>- 2g<br/>- 3g<br/>- 4g<br/>- 5g                         |
| `device_locale`      | string  | Yes      | Locale based on RFC 5646, eg. en-US                                                                                      |
| `threads`            | array   | Yes      | Array of thread objects                                                                                                  |

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

#### **`http`**

Use the `http` body type for tracking a single HTTP network.

| Field                    | Type   | Optional | Comment                                                                         |
|--------------------------|--------|----------|---------------------------------------------------------------------------------|
| `url`                    | string | No       | Complete URL of the HTTP request                                                |
| `method`                 | string | No       | Any of the common HTTP method like, `GET` or `POST`                             |
| `status_code`            | int    | Yes      | Any of the common HTTP response codes.                                          |
| `request_body_size`      | number | Yes      | Size of the HTTP request body in bytes                                          |
| `response_body_size`     | number | Yes      | Size of the HTTP response body in bytes                                         |
| `request_timestamp`      | string | Yes      | ISO 8601 timestamp when the request was sent.                                   |
| `response_timestamp`     | string | Yes      | ISO 8601 timestamp when the response was received.                              |
| `start_time`             | number | Yes      | The uptime at which the http call started, in ms.                               |
| `end_time`               | number | Yes      | The uptime at which the http call ended, in ms.                                 |
| `dns_start`              | number | Yes      | The uptime at which the dns lookup started, in ms.                              |
| `dns_end`                | number | Yes      | The uptime at which the dns lookup ended, in ms.                                |
| `connect_start`          | number | Yes      | The uptime just prior to initiating a socket connection, in ms.                 |
| `connect_end`            | number | Yes      | The uptime just after a socket connection was attempted, in ms.                 |
| `request_start`          | number | Yes      | The uptime as soon as the call is enqueued or executed by a client, in ms.      |
| `request_end`            | number | Yes      | The uptime when the call has completely ended, in ms.                           |
| `request_headers_start`  | number | Yes      | The uptime at which request headers started to be sent, in ms.                  |
| `request_headers_end`    | number | Yes      | The uptime at which request headers were sent, in ms.                           |
| `request_body_start`     | number | Yes      | The uptime at which request body started to be sent, in ms.                     |
| `request_body_end`       | number | Yes      | The uptime at which request body was sent, in ms.                               |
| `response_start`         | number | Yes      | The uptime at which response started to be received, in ms.                     |
| `response_end`           | number | Yes      | The uptime at which response ended, in ms.                                      |
| `response_headers_start` | number | Yes      | The uptime at which response headers started to be sent, in ms.                 |
| `response_headers_end`   | number | Yes      | The uptime at which response headers were sent, in ms.                          |
| `response_body_start`    | number | Yes      | The uptime at which response body was started to be received, in ms.            |
| `response_body_end`      | number | Yes      | The uptime at which response body was received, in ms.                          |
| `request_headers_size`   | number | Yes      | Request headers size in bytes.                                                  |
| `response_headers_size`  | number | Yes      | Response headers size in bytes.                                                 |
| `failure_reason`         | string | Yes      | The reason for failure. For Android, typically the IOException class name.      |
| `failure_description`    | string | Yes      | The description of the failure. For Android, Typically the IOException message. |
| `request_headers`        | string | Yes      | The request headers, a "stringified" map.                                       |
| `response_headers`       | string | Yes      | The response headers, a "stringified" map.                                      |
| `http_protocol_version`  | string | Yes      | Version of the HTTP protocol. `1.0`, `1.1`, `2` etc                             |

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

Use the `cold_launch` type for Android cold app launch time.

| Field                            | Type    | Optional | Comment                                                                |
|----------------------------------|---------|----------|------------------------------------------------------------------------|
| `process_start_uptime`           | number  | Yes      | The start uptime, measure in ms.                                       |
| `process_start_requested_uptime` | number  | Yes      | The start uptime, measure in ms.                                       |
| `content_provider_attach_uptime` | number  | Yes      | The start uptime, measure in ms.                                       |
| `on_next_draw_uptime`            | number  | No       | The time at which the app became visible to the user.                  |
| `launched_activity`              | string  | No       | The activity which drew the first frame during cold launch.            |
| `has_saved_state`                | boolean | No       | Whether the _launched_activity_ was created with a saved state bundle. |
| `intent_data`                    | string  | Yes      | The Intent data used to launch the _launched_activity_.                |

#### **`warm_launch`**

Use the `warm_launch` type for Android warm app launch time.

| Field               | Type    | Optional | Comment                                                                |
|---------------------|---------|----------|------------------------------------------------------------------------|
| app_visible_uptime  | number  | Yes      | The time since the app became visible to the user, in ms.              |
| on_next_draw_uptime | number  | No       | The time at which the app became visible to the user, in ms.           |
| launched_activity   | string  | No       | The activity which drew the first frame during launch                  |
| has_saved_state     | boolean | No       | Whether the _launched_activity_ was created with a saved state bundle. |
| intent_data         | string  | Yes      | The Intent data used to launch the _launched_activity_.                |

#### **`hot_launch`**
 
Use the `hot_launch` type for Android hot app launch time.

| Field               | Type    | Optional | Comment                                                           |
|---------------------|---------|----------|-------------------------------------------------------------------|
| app_visible_uptime  | number  | Yes      | The time elapsed since the app became visible to the user, in ms. |
| on_next_draw_uptime | number  | No       | The time at which the app became visible to the user, in ms.      |
| launched_activity   | string  | No       | The activity which drew the first frame during launch             |
| has_saved_state     | boolean | No       | Whether the _launched_activity_ was created with a saved state.   |
| intent_data         | string  | Yes      | The Intent data used to launch the _launched_activity_.           |

#### **`cpu_usage`**

Use the `cpu_usage` type for CPU usage of a Linux based OS.

| Field             | Type   | Optional | Description                                                         |
|-------------------|:-------|:---------|---------------------------------------------------------------------|
| `num_cores`       | number | No       | Number of cores in the device.                                      |
| `clock_speed`     | number | No       | Clock speed of the device, in Hz.                                   |
| `uptime`          | number | No       | Time since the device booted, in ms.                                |
| `utime`           | number | No       | Time spent executing code in user mode, in Jiffies.                 |
| `stime`           | number | No       | Time spent executing code in kernel mode, in Jiffies.               |
| `cutime`          | number | No       | Time spent executing code in user mode with children, in Jiffies.   |
| `cstime`          | number | No       | Time spent executing code in kernel mode with children, in Jiffies. |
| `interval_config` | number | No       | The interval between two collections, in ms.                        |
| `start_time`      | number | No       | The process start time, in Jiffies.                                 |

#### **`memory_usage`**

Use the `memory_usage` type for memory usage of JVM applications.

| Field             | Type   | Optional | Description                                                                                                                   |
|-------------------|:-------|:---------|-------------------------------------------------------------------------------------------------------------------------------|
| java_max_heap     | number | No       | Maximum size of the Java heap allocated to the application. Measured in kB.                                                   |
| java_total_heap   | number | No       | Total size of the Java heap available for memory allocation. Measured in kB.                                                  |
| java_free_heap    | number | No       | Amount of free memory available in the Java heap. Measured in kB.                                                             |                                                              
| total_pss         | number | No       | Total proportional set size - the amount of memory used by the process, including shared memory and code. Measured in kB.     |
| rss               | number | Yes      | Resident set size of the Java process - the amount of physical memory currently used by the Java application. Measured in kB. |
| native_total_heap | number | No       | Total size of the native heap (memory outside of Java's control) available for memory allocation. Measured in kB.             |
| native_free_heap  | number | No       | Amount of free memory available in the native heap. Measured in kB.                                                           |
| interval_config   | number | No       | The interval between two consecutive readings. Measured in ms.                                                                |

#### **`low_memory`**

Use the `low_memory` type for a low memory event from the system. This type has no additional fields.

#### **`trim_memory`**

Use the `trim_memory` type for a trim memory event raised by Android.

| Field | Type   | Optional | Description                                                                                                                              |
|-------|--------|----------|------------------------------------------------------------------------------------------------------------------------------------------|
| level | string | No       | One of the constants from [ComponentCallbacks2](https://developer.android.com/reference/android/content/ComponentCallbacks2#constants_1) |


#### **`navigation`**

Use the `navigation` type for navigation events.

| Field | Type   | Optional | Description                        |
|-------|--------|----------|------------------------------------|
| route | string | No       | The destination route.             |
