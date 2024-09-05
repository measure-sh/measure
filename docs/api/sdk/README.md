# SDK REST API Documentation <!-- omit in toc -->

Find all the endpoints, resources and detailed documentation for Measure SDK REST APIs.

## Contents <!-- omit in toc -->

- [Resources](#resources)
  - [PUT `/events`](#put-events)
    - [Usage Notes](#usage-notes)
    - [Request Headers](#request-headers)
    - [Response Body](#response-body)
    - [Request Body](#request-body)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting)
  - [PUT `/builds`](#put-builds)
    - [Usage Notes](#usage-notes-1)
    - [Authorization \& Content Type](#authorization--content-type)
    - [Response Body](#response-body-1)
    - [Request Body](#request-body-1)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-1)
- [References](#references)
  - [Attributes](#attributes)
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
    - [**`network_change`**](#network_change)
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

- [**PUT `/events`**](#put-events) - Send a batch of events, attachments, metrics and traces via this endpoint.
- [**PUT `/builds`**]() - Send build mappings and build sizes via this API.

### PUT `/events`

Ingests a batch of events, which can be of different types and can range across multiple sessions.

#### Usage Notes

- Maximum size of one request must not exceed **20 MiB**. This limit is includes the combination of events and blob data.
- Each request must contain a unique UUIDv4 id, set as the header `msr-req-id`. If a request fails, the client must
  retry the same payload with the same `msr-req-id` to ensure idempotency.
- Each event must contain a nanosecond precision `timestamp` - `"2023-08-24T14:51:38.000000534Z"`
- Each event must have the following mandatory attributes:
    - `installation_id`
    - `measure_sdk_version`
    - `thread_name`
    - `platform`
    - `app_version`
    - `app_build`
    - `app_unique_id`
- At least 1 event must be present in the `events` array field. They must be one of the valid types, like `string`, `gesture_long_click` and so on.
- Successful response returns `202 Accepted`.
- Idempotent based on `msr-req-id`. Previously seen requests matching by `msr-req-id` won't be re-processed.

#### Request Headers

1. Set the Measure API key in `Authorization: Bearer <api-key>` format

2. Set content type as `Content-Type: multipart/form-data; boundary=SDKBoundary`. The value of boundary can be any arbitrary string. Make sure the value doesn' change in a single request.

3. Set a unique UUIDv4 id as `msr-req-id` header.

4. Name of each field must be present in a `Content-Disposition` field. Example - `Content-Disposition: form-data; name="event"`

5. Each blob field must start with the `blob-` prefix followed by the id of the blob. Example - `blob-14228029-d52d-45c7-8054-c8e9586d009a`.

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                                 |
| --------------- | ----------------------------------------- |
| `Authorization` | Bearer &lt;measure-api-key&gt;            |
| `Content-Type`  | multipart/form-data; boundary=SDKBoundary |
| `msr-req-id`    | &lt;unique-uuid&gt;                       |

</details>

#### Response Body

- For new event requests

  ```json
  {
    "ok": "accepted"
  }
  ```

- For already seen `msr-req-id`

  ```json
  {
    "ok": "accepted, known event request"
  }
  ```

  > ⚠ **Note**
  >
  > A success response of `202 Accepted` implies the server has accepted the request, but it may choose to not process & discard some events depending on various conditions.

- Failed requests have the following response shape

  ```json
  {
    "error": "error message appears here"
  }
  ```

#### Request Body

To understand the shape of the multipart/form-data payload, take a look at this sample request. You'll find detailed reference of `events` shapes below.

**Example payload**

<details>
<summary>Expand</summary>

```
--PieBoundary123456789012345678901234567
Content-Disposition: form-data; name="event"

{"type":"string","id":"233a2fbc-a0d1-4912-a92f-9e43e72afbc6","session_id":"633a2fbc-a0d1-4912-a92f-9e43e72afbc6","string":{"severity_text":"INFO","string":"This is a log from the Android logcat"},"timestamp":"2023-08-24T14:51:38.000000534Z","attributes":{"user_id":null,"installation_id":"322a2fbc-a0d1-1212-a92f-9e43e72afbc7","device_name":"sunfish","device_model":"SM-G950F","device_manufacturer":"samsung","device_type":"phone","device_is_foldable":true,"device_is_physical":false,"device_density_dpi":100,"device_width_px":480,"device_height_px":800,"device_density":2,"os_name":"android","os_version":"31","platform":"android","app_version":"1.0.1","app_build":"576358","app_unique_id":"com.example.app","network_type":"cellular","network_provider":"airtel","network_generation":"4g","measure_sdk_version":"0.0.1"},"attachments":[]}
--PieBoundary123456789012345678901234567
Content-Disposition: form-data; name="event"

{"type":"gesture_long_click","id":"9873a2fb-a0d1-4912-a92f-9e43e72afbc6","timestamp":"2023-08-24T14:51:40.000000534Z","session_id":"633a2fbc-a0d1-4912-a92f-9e43e72afbc6","gesture_long_click":{"target":"some_target_name","target_id":"some-target-id","touch_down_time":3394122,"touch_up_time":3395418,"width":1440,"height":996,"x":1234,"y":340},"attributes":{"user_id":null,"installation_id":"322a2fbc-a0d1-1212-a92f-9e43e72afbc7","device_name":"sunfish","device_model":"SM-G950F","device_manufacturer":"samsung","device_type":"phone","device_is_foldable":true,"device_is_physical":false,"device_density_dpi":100,"device_width_px":480,"device_height_px":800,"device_density":2,"os_name":"android","os_version":"31","platform":"android","app_version":"1.0.1","app_build":"576358","app_unique_id":"com.example.app","network_type":"cellular","network_provider":"airtel","network_generation":"4g","measure_sdk_version":"0.0.1"},"attachments":[{"id":"9e45a0bc-9277-468c-92f6-5eba2afc26e8","name":"screenshot-bla-bla.png","type":"screenshot","extension":"png", "timestamp": "2024-03-18T07:24:52.17200000Z"}]}
--PieBoundary123456789012345678901234567
Content-Disposition: form-data; name="event"

{"type":"gesture_scroll","id":"9873a2fb-a0d1-4912-a92f-9e43e72afbc6","timestamp":"2023-08-24T14:51:41.000000534Z","session_id":"633a2fbc-a0d1-4912-a92f-9e43e72afbc6","gesture_scroll":{"target":"some-scroll-target","target_id":"scroll-target-id","touch_down_time":3394122,"touch_up_time":3395418,"x":1234,"y":340,"end_x":1330,"end_y":370,"direction":"up"},"attributes":{"user_id":null,"installation_id":"322a2fbc-a0d1-1212-a92f-9e43e72afbc7","device_name":"sunfish","device_model":"SM-G950F","device_manufacturer":"samsung","device_type":"phone","device_is_foldable":true,"device_is_physical":false,"device_density_dpi":100,"device_width_px":480,"device_height_px":800,"device_density":2,"os_name":"android","os_version":"31","platform":"android","app_version":"1.0.1","app_build":"576358","app_unique_id":"com.example.app","network_type":"cellular","network_provider":"airtel","network_generation":"4g","measure_sdk_version":"0.0.1","thread_name":"main"},"attachments":[]}
--PieBoundary123456789012345678901234567
Content-Disposition: form-data; name="blob-9e45a0bc-9277-468c-92f6-5eba2afc26e8"


--PieBoundary123456789012345678901234567--
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
| `429 Too Many Requests`     | Rate limit has exceeded. Retry request respecting `Retry-After` response header.                                        |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                              |
| `503 Service Unavailable`   | Measure server is temporarily unavailable. Retry request respecting `Retry-After` response header.                      |

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

3. Value of `<boundary>` can be any string, but make sure the value doesn't change in the same request.

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
| `200 Ok`                    | Build info uploaded                                                                                                     |
| `400 Bad Request`           | Request body is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the Measure API key is not present or has expired.                                                               |
| `413 Content Too Large`     | Build/mapping file size exceeded maximum allowed limit.                                                                 |
| `429 Too Many Requests`     | Rate limit has exceeded. Retry request respecting `Retry-After` response header.                                        |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                              |
| `503 Service Unavailable`   | Measure server is temporarily unavailable. Retry request respecting `Retry-After` response header.                      |

</details>

## References 

Exhaustive list of all JSON fields.

### Attributes

Events can contain the following attributes, some of which are mandatory.

| Field                 | Type    | Optional | Comment                                                                     |
|-----------------------|---------|----------|-----------------------------------------------------------------------------|
| `installation_id`     | string  | No       | A unique identifier for an installation of an app, generated by the client. |
| `app_version`         | string  | No       | App version identifier                                                      |
| `app_build`           | string  | No       | App build identifier                                                        |
| `app_unique_id`       | string  | No       | App bundle identifier                                                       |
| `platform`            | string  | No       | One of:<br>- android<br>- ios<br>- flutter                                  |
| `measure_sdk_version` | string  | No       | Measure SDK version identifier                                              |
| `thread_name`         | string  | Yes      | The thread on which the event was captured                                  |
| `user_id`             | string  | Yes      | ID of the app's end user                                                    |
| `device_name`         | string  | Yes      | Name of the device                                                          |
| `device_model`        | string  | Yes      | Device model                                                                |
| `device_manufacturer` | string  | Yes      | Name of the device manufacturer                                             |
| `device_type`         | string  | Yes      | `phone` or `tablet`                                                         |
| `device_is_foldable`  | boolean | Yes      | `true` for foldable devices                                                 |
| `device_is_physical`  | boolean | Yes      | `true` for physical devices                                                 |
| `device_density_dpi`  | uint16  | Yes      | DPI density                                                                 |
| `device_width_px`     | uint16  | Yes      | Screen width                                                                |
| `device_height_px`    | uint16  | Yes      | Screen height                                                               |
| `device_density`      | float32 | Yes      | Device density                                                              |
| `device_locale`       | string  | Yes      | Locale based on RFC 5646, eg. en-US                                         |
| `os_name`             | string  | Yes      | Operating system name                                                       |
| `os_version`          | string  | Yes      | Operating system version                                                    |
| `network_type`        | string  | No       | One of<br/>- wifi<br/>- cellular<br/>- vpn<br/>- unknown<br/>- no_network   |
| `network_provider`    | string  | No       | Example: airtel, T-mobile or "unknown" if unavailable.                      |
| `network_generation`  | string  | No       | One of:<br/>- 2g<br/>- 3g<br/>- 4g<br/>- 5g<br/>- unknown                   |

### Attachments

Attachments are arbitrary files associated with the session each having the following properties.

| Field  | Type   | Optional | Comment                                                                 |
| ------ | ------ | -------- | ----------------------------------------------------------------------- |
| `id`   | string | No       | id of the attachment                                                    |
| `name` | string | No       | name of the attachment                                                  |
| `type` | string | No       | One of the following:<br />- `screenshot`<br />- `android_method_trace` |

### Events

Event objects have the following shape. Additionally, each object must contain one of the event types of the same name. The following is an example event of type `gesture_click`.

```jsonc
{
  "id": "1c8a5e51-4d7d-4b2c-9be8-1abb31d38f90",
  "type": "gesture_click",
  "session_id": "633a2fbc-a0d1-4912-a92f-9e43e72afbc6",
  "timestamp": "2023-08-24T14:51:41.000000534Z",
  "user_triggered": false,
  "gesture_click": {
    // snip gesture_click fields
  },
  "attribute": {
    // snip attributes fields
  },
  "attachments": {
    // snip attachment fields
  }
}
```

| Field            | Type   | Optional | Comment                                                                                                                    |
| ---------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`             | string | No       | UUID of the event                                                                                                          |
| `type`           | string | No       | Type of the event                                                                                                          |
| `session_id`     | string | No       | UUID of the session                                                                                                        |
| `timestamp`      | string | No       | Nanosecond precision timestamp                                                                                             |
| `user_triggered` | bool   | Yes      | True, when the event is triggered by SDK consumer.                                                                         |
| `<event type>`   | object | No       | Any of the event object, like `gesture_click`, `exception` etc                                                             |
| `attributes`     | object | No       | Event attributes                                                                                                           |
| `attachments`    | object | No       | Attachments for the event. Must be an array of attachment objects. Represent with emtpy array if there are no attachments. |

### Event Types

Each event object must be of one of the following types. Refer to the sample payload above to understand the shape of each object.

#### **`anr`**

Use the `anr` type for [Application Not Responding](https://developer.android.com/topic/performance/vitals/anr) events. 

| Field        | Type    | Optional | Comment                                                         |
| ------------ | ------- | -------- | --------------------------------------------------------------- |
| `handled`    | boolean | No       | `false` for crashes, `true` if exceptions are handled           |
| `exceptions` | array   | No       | Array of exception objects                                      |
| `foreground` | boolean | No       | `true` if the app was in the foreground at the time of the ANR. |
| `threads`    | array   | Yes      | Array of thread objects                                         |

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
| ------------- |--------| -------- | ------------------------------ |
| `line_num`    | int    | Yes      | Line number of the method      |
| `col_num`     | int    | Yes      | Column number of the method    |
| `module_name` | string | Yes      | Name of the originating module |
| `file_name`   | string | Yes      | Name of the originating file   |
| `class_name`  | string | Yes      | Name of the originating class  |
| `method_name` | string | Yes      | Name of the originating method |

#### **`exception`**

Use the `exception` type for errors and crashes. 

| Field        | Type    | Optional | Comment                                                               |
| ------------ | ------- | -------- | --------------------------------------------------------------------- |
| `handled`    | boolean | No       | `false` for crashes, `true` if exceptions are handled                 |
| `exceptions` | array   | No       | Array of exception objects                                            |
| `foreground` | boolean | Yes      | `true` if the app was in the foreground at the time of the exception. |
| `threads`    | array   | Yes      | Array of thread objects                                               |

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
| ------------- |--------| -------- | ------------------------------ |
| `line_num`    | int    | Yes      | Line number of the method      |
| `col_num`     | int    | Yes      | Column number of the method    |
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

| Field             | Type    | Optional | Comment                                     |
|-------------------|---------|----------|---------------------------------------------|
| `target`          | string  | Yes      | Class/Instance name of the originating view |
| `target_id`       | string  | Yes      | Unique identifier for the target            |
| `touch_down_time` | uint64  | Yes      | System uptime when target was pressed       |
| `touch_up_time`   | uint64  | Yes      | System uptime when target was released      |
| `width`           | uint16  | Yes      | Width of the target view in pixels          |
| `height`          | uint16  | Yes      | Height of the target view in pixels         |
| `x`               | float32 | No       | X coordinate of the target view             |
| `y`               | float32 | No       | Y coordinate of the target view             |

#### **`gesture_scroll`**

Use the `gesture_scroll` body type for scroll events.

| Field             | Type    | Optional | Comment                                             |
|-------------------|---------|----------|-----------------------------------------------------|
| `target`          | string  | Yes      | Class/Instance name of the originating view         |
| `target_id`       | string  | Yes      | Unique identifier for the target                    |
| `touch_down_time` | uint64  | Yes      | System uptime when target scroll started            |
| `touch_up_time`   | uint64  | Yes      | System uptime when target scroll ended              |
| `x`               | float32 | No       | X coordinate of the target where scroll started     |
| `y`               | float32 | No       | Y coordinate of the target where scroll started     |
| `end_x`           | float32 | No       | X coordinate of the target where scroll ended       |
| `end_y`           | float32 | No       | Y coordinate of the target where scroll ended       |
| `direction`       | string  | Yes      | The direction of the scroll - left, right, up, down |

#### **`gesture_click`**

Use the `gesture_click` body type for taps or clicks.

| Field             | Type    | Optional | Comment                                         |
|-------------------|---------|----------|-------------------------------------------------|
| `target`          | string  | Yes      | Class/Instance name of the originating view     |
| `target_id`       | string  | Yes      | Unique identifier for the target                |
| `touch_down_time` | uint64  | Yes      | System uptime when target was pressed           |
| `touch_up_time`   | uint64  | Yes      | System uptime when target was released          |
| `width`           | uint16  | Yes      | Width of the target view in pixels              |
| `height`          | uint16  | Yes      | Height of the target view in pixels             |
| `x`               | float32 | No       | X coordinate of the target where click happened |
| `y`               | float32 | No       | Y coordinate of the target where click happened |

#### **`http`**

Use the `http` body type for tracking a single HTTP network.

| Field                 | Type   | Optional | Comment                                                                         |
|-----------------------|--------|----------|---------------------------------------------------------------------------------|
| `url`                 | string | No       | Complete URL of the HTTP request                                                |
| `method`              | string | No       | Any of the common HTTP method like, `GET` or `POST`                             |
| `status_code`         | int    | Yes      | Any of the common HTTP response codes.                                          |
| `start_time`          | uint64 | Yes      | The uptime at which the http call started, in ms.                               |
| `end_time`            | uint64 | Yes      | The uptime at which the http call ended, in ms.                                 |
| `failure_reason`      | string | Yes      | The reason for failure. For Android, typically the IOException class name.      |
| `failure_description` | string | Yes      | The description of the failure. For Android, Typically the IOException message. |
| `request_headers`     | map    | Yes      | The request headers.                                                            |
| `response_headers`    | map    | Yes      | The response headers.                                                           |
| `request_body`        | string | Yes      | The request body, if any. Only supported for json body.                         |
| `response_body`       | string | Yes      | The response body, if any. Only supported for json body.                        |
| `client`              | string | Yes      | Name of the http client like `Okhttp`                                           |


#### **`network_change`**

Use the `network_change` type for tracking changes to the network state of the device.

| Field                         | Type   | Optional | Comment                                                                   |
| ----------------------------- | ------ | -------- | ------------------------------------------------------------------------- |
| `network_type`                | string | No       | One of<br/>- wifi<br/>- cellular<br/>- vpn<br/>- unknown<br/>- no_network |
| `network_provider`            | string | No       | Example: airtel, T-mobile or "unknown" if unavailable.                    |
| `network_generation`          | string | No       | One of:<br/>- 2g<br/>- 3g<br/>- 4g<br/>- 5g<br/>- unknown                 |
| `previous_network_type`       | string | No       | One of<br/>- wifi<br/>- cellular<br/>- vpn<br/>- unknown<br/>- no_network |
| `previous_network_generation` | string | No       | One of:<br/>- 2g<br/>- 3g<br/>- 4g<br/>- 5g<br/>- unknown                 |


#### **`app_exit`**

Use the `app_exit` type for Application Exit events.

| Field          | Type   | Optional | Comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- |--------| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reason`       | string | No       | One of the following:<br />- `REASON_ANR`<br />- `REASON_CRASH`<br />- `REASON_CRASH_NATIVE`<br />- `REASON_DEPENDENCY_DIED`<br />- `REASON_EXCESSIVE_RESOURCE_USAGE`<br />- `REASON_EXIT_SELF`<br />- `REASON_FREEZER`<br />- `REASON_INITIALIZATION_FAILURE`<br />- `REASON_LOW_MEMORY`<br />- `REASON_OTHER`<br />- `REASON_PACKAGE_STATE_CHANGE`<br />- `REASON_PACKAGE_UPDATED`<br />- `REASON_PERMISSION_CHANGE`<br />- `REASON_SIGNALED`<br />- `REASON_UNKNOWN`<br />- `REASON_USER_REQUESTED`<br />- `REASON_USER_STOPPED` |
| `importance`   | string | No       | Importance of the process that it used to have before death<br />- `IMPORTANCE_FOREGROUND`<br />- `IMPORTANCE_FOREGROUND_SERVICE`<br />- `IMPORTANCE_TOP_SLEEPING`<br />- `IMPORTANCE_VISIBLE`<br />- `IMPORTANCE_PERCEPTIBLE`<br />- `IMPORTANCE_CANT_SAVE_STATE`<br />- `IMPORTANCE_SERVICE`<br />- `IMPORTANCE_CACHED`<br />- `IMPORTANCE_GONE`                                                                                                                                                                                  |
| `trace`        | string | Yes      | Modified trace given by ApplicationExitInfo to help debug ANRs. Must be only set for session that had an ANR.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `process_name` | string | No       | Name of the process                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pid`          | string | Yes      | ID of the process that died                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
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
| -------------------------------- | ------- | -------- | ---------------------------------------------------------------------- |
| `process_start_uptime`           | uint64  | Yes      | The start uptime, measure in ms.                                       |
| `process_start_requested_uptime` | uint64  | Yes      | The start uptime, measure in ms.                                       |
| `content_provider_attach_uptime` | uint64  | Yes      | The start uptime, measure in ms.                                       |
| `on_next_draw_uptime`            | uint64  | No       | The time at which the app became visible to the user.                  |
| `launched_activity`              | string  | No       | The activity which drew the first frame during cold launch.            |
| `has_saved_state`                | boolean | No       | Whether the _launched_activity_ was created with a saved state bundle. |
| `intent_data`                    | string  | Yes      | The Intent data used to launch the _launched_activity_.                |

#### **`warm_launch`**

Use the `warm_launch` type for Android warm app launch time.

| Field               | Type    | Optional | Comment                                                                |
| ------------------- | ------- | -------- | ---------------------------------------------------------------------- |
| app_visible_uptime  | uint64  | Yes      | The time since the app became visible to the user, in ms.              |
| on_next_draw_uptime | uint64  | No       | The time at which the app became visible to the user, in ms.           |
| launched_activity   | string  | No       | The activity which drew the first frame during launch                  |
| has_saved_state     | boolean | No       | Whether the _launched_activity_ was created with a saved state bundle. |
| intent_data         | string  | Yes      | The Intent data used to launch the _launched_activity_.                |

#### **`hot_launch`**
 
Use the `hot_launch` type for Android hot app launch time.

| Field               | Type    | Optional | Comment                                                           |
| ------------------- | ------- | -------- | ----------------------------------------------------------------- |
| app_visible_uptime  | uint64  | Yes      | The time elapsed since the app became visible to the user, in ms. |
| on_next_draw_uptime | uint64  | No       | The time at which the app became visible to the user, in ms.      |
| launched_activity   | string  | No       | The activity which drew the first frame during launch             |
| has_saved_state     | boolean | No       | Whether the _launched_activity_ was created with a saved state.   |
| intent_data         | string  | Yes      | The Intent data used to launch the _launched_activity_.           |

#### **`cpu_usage`**

Use the `cpu_usage` type for CPU usage of a Linux based OS.

| Field              | Type    | Optional | Description                                                         |
|--------------------|:--------|:---------|---------------------------------------------------------------------|
| `num_cores`        | uint8   | No       | Number of cores in the device.                                      |
| `clock_speed`      | uint32  | No       | Clock speed of the device, in Hz.                                   |
| `uptime`           | uint64  | No       | Time since the device booted, in ms.                                |
| `utime`            | uint64  | No       | Time spent executing code in user mode, in Jiffies.                 |
| `stime`            | uint64  | No       | Time spent executing code in kernel mode, in Jiffies.               |
| `cutime`           | uint64  | No       | Time spent executing code in user mode with children, in Jiffies.   |
| `cstime`           | uint64  | No       | Time spent executing code in kernel mode with children, in Jiffies. |
| `interval`         | uint64  | No       | The interval between two collections, in ms.                        |
| `percentage_usage` | float64 | No       | The percentage CPU usage in the interval.                           |
| `start_time`       | uint64  | No       | The process start time, in Jiffies.                                 |

#### **`memory_usage`**

Use the `memory_usage` type for memory usage of JVM applications.

| Field             | Type   | Optional | Description                                                                                                                   |
|-------------------|:-------|:---------|-------------------------------------------------------------------------------------------------------------------------------|
| java_max_heap     | uint64 | No       | Maximum size of the Java heap allocated to the application. Measured in kB.                                                   |
| java_total_heap   | uint64 | No       | Total size of the Java heap available for memory allocation. Measured in kB.                                                  |
| java_free_heap    | uint64 | No       | Amount of free memory available in the Java heap. Measured in kB.                                                             |
| total_pss         | uint64 | No       | Total proportional set size - the amount of memory used by the process, including shared memory and code. Measured in kB.     |
| rss               | uint64 | Yes      | Resident set size of the Java process - the amount of physical memory currently used by the Java application. Measured in kB. |
| native_total_heap | uint64 | No       | Total size of the native heap (memory outside of Java's control) available for memory allocation. Measured in kB.             |
| native_free_heap  | uint64 | No       | Amount of free memory available in the native heap. Measured in kB.                                                           |
| interval          | uint64 | No       | The interval between two consecutive readings. Measured in ms.                                                                |

#### **`low_memory`**

Use the `low_memory` type for a low memory event from the system.

| Field             | Type   | Optional | Description                                                                                                                   |
|-------------------|:-------|:---------|-------------------------------------------------------------------------------------------------------------------------------|
| java_max_heap     | uint64 | No       | Maximum size of the Java heap allocated to the application. Measured in kB.                                                   |
| java_total_heap   | uint64 | No       | Total size of the Java heap available for memory allocation. Measured in kB.                                                  |
| java_free_heap    | uint64 | No       | Amount of free memory available in the Java heap. Measured in kB.                                                             |
| total_pss         | uint64 | No       | Total proportional set size - the amount of memory used by the process, including shared memory and code. Measured in kB.     |
| rss               | uint64 | Yes      | Resident set size of the Java process - the amount of physical memory currently used by the Java application. Measured in kB. |
| native_total_heap | uint64 | No       | Total size of the native heap (memory outside of Java's control) available for memory allocation. Measured in kB.             |
| native_free_heap  | uint64 | No       | Amount of free memory available in the native heap. Measured in kB.                                                           |

#### **`trim_memory`**

Use the `trim_memory` type for a trim memory event raised by Android.

| Field | Type   | Optional | Description                                                                                                                              |
| ----- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| level | string | No       | One of the constants from [ComponentCallbacks2](https://developer.android.com/reference/android/content/ComponentCallbacks2#constants_1) |



#### **`navigation`**

Use the `navigation` type for navigation events.

| Field  | Type   | Optional | Description                                                                                                                                                     |
| ------ | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| source | string | Yes      | Adds context on how the event was collected. Null if not set.<br/>Example: `androidx_navigation` if the event was collected from `androidx.navigation` library. |
| from   | string | Yes      | The source page or screen from where the navigation was triggered, if available, null otherwise.                                                                |
| to     | string | No       | The destination page or screen where the navigation led to.                                                                                                     |
