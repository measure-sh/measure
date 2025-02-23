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
  - [User Defined Attributes](#user-defined-attributes)
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
    - [**`lifecycle_view_controller`**](#lifecycle_view_controller)
    - [**`lifecycle_swift_ui`**](#lifecycle_swift_ui)
    - [**`lifecycle_app`**](#lifecycle_app)
    - [**`cold_launch`**](#cold_launch)
    - [**`warm_launch`**](#warm_launch)
    - [**`hot_launch`**](#hot_launch)
    - [**`cpu_usage`**](#cpu_usage)
    - [**`memory_usage`**](#memory_usage)
    - [**`memory_usage_absolute`**](#memory_usage_absolute)
    - [**`low_memory`**](#low_memory)
    - [**`trim_memory`**](#trim_memory)
    - [**`navigation`**](#navigation)
    - [**`screen_view`**](#screen_view)
    - [**`custom`**](#custom)
  - [Traces](#traces)

## Resources

- [**PUT `/events`**](#put-events) - Send a batch of events, spans, attachments, metrics and traces via this endpoint.
- [**PUT `/builds`**]() - Send build mappings and build sizes via this API.

### PUT `/events`

Ingests a batch of events, which can be of different types and can range across multiple sessions.

#### Usage Notes

- Maximum size of one request must not exceed **20 MiB**. This limit is includes the combination of events and blob data.
- Each request must contain a unique UUIDv4 id, set as the header `msr-req-id`. If a request fails, the client must
  retry the same payload with the same `msr-req-id` to ensure idempotency.
- Each event must contain a nanosecond precision `timestamp` - `"2023-08-24T14:51:38.000000534Z"`.
- Each request must not contain duplicate event ids.
- Each request must not contain duplicate span ids.
- Each span must contain a nanosecond precision `start_time` and `end_time` - `"2023-08-24T14:51:38.000000534Z"`.
- Each event must have the following mandatory attributes:
    - `attribute.installation_id`
    - `attribute.measure_sdk_version`
    - `attribute.thread_name`
    - `attribute.platform`
    - `attribute.app_version`
    - `attribute.app_build`
    - `attribute.app_unique_id`
- Each span must have the following mandatory fields:
    - `span_name`
    - `span_id`
    - `trace_id`
    - `session_id`
    - `status`
    - `start_time`
    - `end_time`
    - `attribute.installation_id`
    - `attribute.measure_sdk_version`
    - `attribute.platform`
    - `attribute.app_version`
    - `attribute.os_version`
    - `attribute.app_unique_id`

- At least 1 event must be present in the `events` array field or 1 span must be present in the `spans` array field. Both arrays must
not be empty.
- Successful response returns `202 Accepted`.
- Response may contain a `Retry-After: 60` header. If present, the client should retry the same request after 60 seconds. Note, that value indicating number of seconds may change.
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

- For another identical `msr-req-id` in progress

  ```
  // snip other headers
  Retry-After: 60
  ```

  ```json
  {
    "warning": "a previous accepted request is in progress, retry after 60 seconds"
  }
  ```


> [!NOTE]
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

{"type":"string","id":"233a2fbc-a0d1-4912-a92f-9e43e72afbc6","session_id":"633a2fbc-a0d1-4912-a92f-9e43e72afbc6","string":{"severity_text":"INFO","string":"This is a log from the Android logcat"},"timestamp":"2023-08-24T14:51:38.000000534Z","attribute":{"user_id":null,"installation_id":"322a2fbc-a0d1-1212-a92f-9e43e72afbc7","device_name":"sunfish","device_model":"SM-G950F","device_manufacturer":"samsung","device_type":"phone","device_is_foldable":true,"device_is_physical":false,"device_density_dpi":100,"device_width_px":480,"device_height_px":800,"device_density":2,"os_name":"android","os_version":"31","platform":"android","app_version":"1.0.1","app_build":"576358","app_unique_id":"com.example.app","network_type":"cellular","network_provider":"airtel","network_generation":"4g","measure_sdk_version":"0.0.1"},"user_defined_attribute":{"username":"alice","paid_user":true,"credit_balance":12345,"latitude":30.2661403415387},"attachments":[]}
--PieBoundary123456789012345678901234567
Content-Disposition: form-data; name="event"

{"type":"gesture_long_click","id":"9873a2fb-a0d1-4912-a92f-9e43e72afbc6","timestamp":"2023-08-24T14:51:40.000000534Z","session_id":"633a2fbc-a0d1-4912-a92f-9e43e72afbc6","gesture_long_click":{"target":"some_target_name","target_id":"some-target-id","touch_down_time":3394122,"touch_up_time":3395418,"width":1440,"height":996,"x":1234,"y":340},"attribute":{"user_id":null,"installation_id":"322a2fbc-a0d1-1212-a92f-9e43e72afbc7","device_name":"sunfish","device_model":"SM-G950F","device_manufacturer":"samsung","device_type":"phone","device_is_foldable":true,"device_is_physical":false,"device_density_dpi":100,"device_width_px":480,"device_height_px":800,"device_density":2,"os_name":"android","os_version":"31","platform":"android","app_version":"1.0.1","app_build":"576358","app_unique_id":"com.example.app","network_type":"cellular","network_provider":"airtel","network_generation":"4g","measure_sdk_version":"0.0.1"},"attachments":[{"id":"9e45a0bc-9277-468c-92f6-5eba2afc26e8","name":"screenshot-bla-bla.png","type":"screenshot","extension":"png", "timestamp": "2024-03-18T07:24:52.17200000Z"}]}
--PieBoundary123456789012345678901234567
Content-Disposition: form-data; name="event"

{"type":"gesture_scroll","id":"9873a2fb-a0d1-4912-a92f-9e43e72afbc6","timestamp":"2023-08-24T14:51:41.000000534Z","session_id":"633a2fbc-a0d1-4912-a92f-9e43e72afbc6","gesture_scroll":{"target":"some-scroll-target","target_id":"scroll-target-id","touch_down_time":3394122,"touch_up_time":3395418,"x":1234,"y":340,"end_x":1330,"end_y":370,"direction":"up"},"attribute":{"user_id":null,"installation_id":"322a2fbc-a0d1-1212-a92f-9e43e72afbc7","device_name":"sunfish","device_model":"SM-G950F","device_manufacturer":"samsung","device_type":"phone","device_is_foldable":true,"device_is_physical":false,"device_density_dpi":100,"device_width_px":480,"device_height_px":800,"device_density":2,"os_name":"android","os_version":"31","platform":"android","app_version":"1.0.1","app_build":"576358","app_unique_id":"com.example.app","network_type":"cellular","network_provider":"airtel","network_generation":"4g","measure_sdk_version":"0.0.1","thread_name":"main"},"attachments":[]}
--PieBoundary123456789012345678901234567
Content-Disposition: form-data; name="blob-9e45a0bc-9277-468c-92f6-5eba2afc26e8"


--PieBoundary123456789012345678901234567--
Content-Disposition: form-data; name="span"

{"name":"activity.onCreate","trace_id":"d71f3d909689859469a7d9b38e605d56","span_id":"9f1890db9aedb305","parent_id":null,"session_id":"a2768feb-59cd-433f-bf00-d36ab297eddb","start_time":"2024-11-18T14:14:40.54500000Z","end_time":"2024-11-18T14:14:40.62000000Z","duration":75,"status":0,"attributes":{"thread_name":"main","user_id":null,"device_name":"emu64a16k","device_model":"sdk_gphone16k_arm64","device_manufacturer":"Google","device_locale":"en-US","os_name":"android","os_version":"35","platform":"android","app_version":"0.9.0-SNAPSHOT.debug","app_build":"900","app_unique_id":"sh.measure.sample","measure_sdk_version":"0.9.0-SNAPSHOT","installation_id":"2ee2d03e-ed76-43e7-8d63-9e146f1df618","network_type":"wifi","network_generation":"unknown","network_provider":"unknown"},"checkpoints":[]}

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

List of all the fields of the multipart request.

| Field          | Type   | Optional | Comment                                                           |
| -------------- | ------ | -------- | ----------------------------------------------------------------- |
| `version_name` | string | No       | Version name of the build. Like "1.0"                             |
| `version_code` | string | No       | Version code of the build. Like "999"                             |
| `mapping_type` | string | Yes      | Type of the mapping file. `proguard` for Android, `dsym` for iOS. |
| `mapping_file` | string | Yes      | File bytes of mapping file                                        |
| `build_size`   | string | No       | Size of app in bytes                                              |
| `build_type`   | string | No       | Type of the build. `aab` for Android, `ipa` for iOS.              |
| `platform`     | string | Yes      | Platform of the app. `android` for Android, `ios` for iOS.        |

- Mapping file size should not exceed **512 MiB**.
- `mapping_type` &amp; `mapping_file` are optional. Both need to be present for mapping file uploads to work.
- `version_name`, `version_code`, `build_size` &amp; `build_type` are required and cannot be skipped.
- Uploading a previously uploaded mapping file with exact contents for the same combination of `version_name`, `version_code`, `mapping_type` replaces the older mapping file.
- Putting `build_size` for the same `version_name`, `version_code` and `build_type` combination replaces the last size with the latest size.
- Depending on the platform, `mapping_type` can be `proguard` for Android or `dsym` for iOS.
- Depending on the platform, `build_type` can be `aab` for Android or `ipa` for iOS.
- Multiple `mapping_file` is accepted. iOS builds will typically utilize multiple dSYM mapping files.

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

| Field                               | Type    | Optional | Comment                                                                     |
| ----------------------------------- | ------- | -------- | --------------------------------------------------------------------------- |
| `installation_id`                   | string  | No       | A unique identifier for an installation of an app, generated by the client. |
| `app_version`                       | string  | No       | App version identifier                                                      |
| `app_build`                         | string  | No       | App build identifier                                                        |
| `app_unique_id`                     | string  | No       | App bundle identifier                                                       |
| `platform`                          | string  | No       | One of:<br>- android<br>- ios<br>- flutter                                  |
| `measure_sdk_version`               | string  | No       | Measure SDK version identifier                                              |
| `thread_name`                       | string  | Yes      | The thread on which the event was captured                                  |
| `user_id`                           | string  | Yes      | ID of the app's end user                                                    |
| `device_name`                       | string  | Yes      | Name of the device                                                          |
| `device_model`                      | string  | Yes      | Device model                                                                |
| `device_manufacturer`               | string  | Yes      | Name of the device manufacturer                                             |
| `device_type`                       | string  | Yes      | `phone` or `tablet`                                                         |
| `device_is_foldable`                | boolean | Yes      | `true` for foldable devices                                                 |
| `device_is_physical`                | boolean | Yes      | `true` for physical devices                                                 |
| `device_density_dpi`                | uint16  | Yes      | DPI density                                                                 |
| `device_width_px`                   | uint16  | Yes      | Screen width                                                                |
| `device_height_px`                  | uint16  | Yes      | Screen height                                                               |
| `device_density`                    | float32 | Yes      | Device density                                                              |
| `device_locale`                     | string  | Yes      | Locale based on RFC 5646, eg. en-US                                         |
| `device_low_power_mode`             | bool    | Yes      | `true` when low power mode is enabled                                       |
| `device_thermal_throttling_enabled` | bool    | Yes      | `true` when thermal throttling is enabled                                   |
| `os_name`                           | string  | Yes      | Operating system name                                                       |
| `os_version`                        | string  | Yes      | Operating system version                                                    |
| `os_page_size`                      | uint8   | Yes      | Operating system memory page size                                           |
| `network_type`                      | string  | No       | One of<br/>- wifi<br/>- cellular<br/>- vpn<br/>- unknown<br/>- no_network   |
| `network_provider`                  | string  | No       | Example: airtel, T-mobile or "unknown" if unavailable.                      |
| `network_generation`                | string  | No       | One of:<br/>- 2g<br/>- 3g<br/>- 4g<br/>- 5g<br/>- unknown                   |

### User Defined Attributes

Events can optionally contain attributes defined by the SDK user. A `user_defined_attribute` is a JSON key/value pair object. There are some constraints you should be aware of.

- An event may contain a maximum of 100 arbitrary user defined attributes.
- Key names should not exceed 256 characters.
- Key names must be unique in a user defined attribute key/value object.
- Key names must only contain alphabets, numbers, underscores and hyphens.
- Value can be regular String, Boolean or Number JSON types only.
- Number values when integer should be within the range of typical **int64** type. `-9223372036854775808` and `9223372036854775807`.
- Number values when float should not exceed maximum value of typical **float64** type. `1.7976931348623157e+308`.
- String values should not exceed 256 characters.

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
  "user_defined_attribute": {
    "username": "alice",
    "paid_user": true,
    "credit_balance": 12345,
    "latitude": 30.2661403415387
  },
  "attachments": {
    // snip attachment fields
  }
}
```

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
  "user_defined_attribute": {
    // snip user defined attributes fields
  },
  "attachments": {
    // snip attachment fields
  }
}
```

| Field                    | Type   | Optional | Comment                                                                                                                    |
| ------------------------ | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | string | No       | UUID of the event                                                                                                          |
| `type`                   | string | No       | Type of the event                                                                                                          |
| `session_id`             | string | No       | UUID of the session                                                                                                        |
| `timestamp`              | string | No       | Nanosecond precision timestamp                                                                                             |
| `user_triggered`         | bool   | Yes      | True, when the event is triggered by SDK consumer.                                                                         |
| `<event type>`           | object | No       | Any of the event object, like `gesture_click`, `exception` etc                                                             |
| `attribute`              | object | No       | Event attributes                                                                                                           |
| `user_defined_attribute` | object | Yes      | User defined attributes object containing key/value pairs.                                                                 |
| `attachments`            | object | No       | Attachments for the event. Must be an array of attachment objects. Represent with emtpy array if there are no attachments. |

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
| ------------- | ------ | -------- | ------------------------------ |
| `line_num`    | int    | Yes      | Line number of the method      |
| `col_num`     | int    | Yes      | Column number of the method    |
| `module_name` | string | Yes      | Name of the originating module |
| `file_name`   | string | Yes      | Name of the originating file   |
| `class_name`  | string | Yes      | Name of the originating class  |
| `method_name` | string | Yes      | Name of the originating method |

#### **`exception`**

Use the `exception` type for errors and crashes.

| Field           | Type    | Optional | Comment                                                               |
| --------------- | ------- | -------- | --------------------------------------------------------------------- |
| `handled`       | boolean | No       | `false` for crashes, `true` if exceptions are handled                 |
| `exceptions`    | array   | No       | Array of exception objects                                            |
| `foreground`    | boolean | Yes      | `true` if the app was in the foreground at the time of the exception. |
| `threads`       | array   | Yes      | Array of thread objects                                               |
| `binary_images` | array   | Yes      | Array of binary image objects (Darwin only)                           |

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
| `line_num`    | int    | Yes      | Line number of the method      |
| `col_num`     | int    | Yes      | Column number of the method    |
| `module_name` | string | Yes      | Name of the originating module |
| `file_name`   | string | Yes      | Name of the originating file   |
| `class_name`  | string | Yes      | Name of the originating class  |
| `method_name` | string | Yes      | Name of the originating method |

`binary_image` objects

Each binary_image object contains further fields. Only applies to Apple/Darwin apps.

| Field        | Type    | Optional | Comment                                                        |
| ------------ | ------- | -------- | -------------------------------------------------------------- |
| `start_addr` | string  | No       | Start address - where the binary is loaded into virtual memory |
| `end_addr`   | string  | No       | End address - upper memory boundary of the binary              |
| `system`     | boolean | No       | Binary marker - indicates a system binary                      |
| `name`       | string  | No       | Name of the app, framework or libary binary                    |
| `arch`       | string  | No       | CPU architecture the binary is compiled for                    |
| `uuid`       | string  | No       | Unique fingerprint for the binary's build                      |
| `path`       | string  | No       | Full path to where the binary was located at runtime           |

#### **`string`**

Use the `string` type when sending unstructured or structured logs. Make sure structured logs are in stringified JSON format.

| Field           | Type   | Optional | Comment                                                        |
| --------------- | ------ | -------- | -------------------------------------------------------------- |
| `severity_text` | string | Yes      | Log level. One of `info`, `warning`, `error`, `fatal`, `debug` |
| `string`        | string | No       | Log message text                                               |

#### **`gesture_long_click`**

Use the `gesture_long_click` body type for longer press and hold gestures.

| Field             | Type    | Optional | Comment                                     |
| ----------------- | ------- | -------- | ------------------------------------------- |
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
| ----------------- | ------- | -------- | --------------------------------------------------- |
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
| ----------------- | ------- | -------- | ----------------------------------------------- |
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
| --------------------- | ------ | -------- | ------------------------------------------------------------------------------- |
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
| -------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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
| `parent_fragment` | string | Yes      | Fragment's parent fragment's fully qualified class name                                    |
| `tag`             | string | Yes      | [Fragment's Tag](https://developer.android.com/reference/android/app/Fragment#getTag())    |

#### **`lifecycle_view_controller`**

Use the `lifecycle_view_controller` type for iOS ViewController lifecycle events.

| Field        | Type   | Optional | Comment                                                                                                                                                                                                                                                                  |
| ------------ | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`       | string | No       | One of the following:<br />- `loadView` <br />- `viewDidLoad`<br />- `viewWillAppear`<br />- `viewDidAppear`<br />- `viewWillDisappear`<br />- `viewDidDisappear` <br />- `didReceiveMemoryWarning` <br />- `initWithNibName` <br />- `initWithCoder` <br />- `vcDeinit` |
| `class_name` | string | No       | View Controller class name                                                                                                                                                                                                                                               |

#### **`lifecycle_swift_ui`**

Use the `lifecycle_swift_ui` type for iOS SwiftUI view lifecycle events.

| Field        | Type   | Optional | Comment                                                        |
| ------------ | ------ | -------- | -------------------------------------------------------------- |
| `type`       | string | No       | One of the following:<br />- `on_appear`<br />- `on_disappear` |
| `class_name` | string | No       | SwiftUI View class name                                        |

#### **`lifecycle_app`**

Use the `lifecycle_app` type for app's lifecycle events.

| Field  | Type   | Optional | Comment                                                                                                                          |
| ------ | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `type` | string | No       | One of the following:<br />- `background`<br />- `foreground`<br />- `terminated`. `terminated` option is only supported on iOS. |

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
| ------------------ | :------ | :------- | ------------------------------------------------------------------- |
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
| ----------------- | :----- | :------- | ----------------------------------------------------------------------------------------------------------------------------- |
| java_max_heap     | uint64 | No       | Maximum size of the Java heap allocated to the application. Measured in kB.                                                   |
| java_total_heap   | uint64 | No       | Total size of the Java heap available for memory allocation. Measured in kB.                                                  |
| java_free_heap    | uint64 | No       | Amount of free memory available in the Java heap. Measured in kB.                                                             |
| total_pss         | uint64 | No       | Total proportional set size - the amount of memory used by the process, including shared memory and code. Measured in kB.     |
| rss               | uint64 | Yes      | Resident set size of the Java process - the amount of physical memory currently used by the Java application. Measured in kB. |
| native_total_heap | uint64 | No       | Total size of the native heap (memory outside of Java's control) available for memory allocation. Measured in kB.             |
| native_free_heap  | uint64 | No       | Amount of free memory available in the native heap. Measured in kB.                                                           |
| interval          | uint64 | No       | The interval between two consecutive readings. Measured in ms.                                                                |

#### **`memory_usage_absolute`**

Use the `memory_usage` type for absolute memory usage.

| Field         | Type   | Optional | Description                                                    |
| ------------- | :----- | :------- | -------------------------------------------------------------- |
| `max_memory`  | uint64 | No       | Maximum size of memory available to the application, in kB.    |
| `used_memory` | uint64 | No       | Memory used by the application, in kB.                         |
| `interval`    | uint64 | No       | The interval between two consecutive readings. Measured in ms. |

#### **`low_memory`**

Use the `low_memory` type for a low memory event from the system.

> [!NOTE]
>
> This event is no longer tracked. The callback is deprecated and the general guidance is to rely on
> trim_memory events instead. Removed in Android SDK version 0.8.0.
> https://developer.android.com/reference/android/content/ComponentCallbacks#onLowMemory()

| Field             | Type   | Optional | Description                                                                                                                   |
| ----------------- | :----- | :------- | ----------------------------------------------------------------------------------------------------------------------------- |
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

> ![IMPORTANT]
> This event is no longer tracked and will be removed in future versions.
> Android SDK removed support for this event from v0.9.0 onwards.

| Field  | Type   | Optional | Description                                                                                                                                                     |
| ------ | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| source | string | Yes      | Adds context on how the event was collected. Null if not set.<br/>Example: `androidx_navigation` if the event was collected from `androidx.navigation` library. |
| from   | string | Yes      | The source page or screen from where the navigation was triggered, if available, null otherwise.                                                                |
| to     | string | No       | The destination page or screen where the navigation led to.                                                                                                     |


#### **`screen_view`**

Use the `screen_view` type for screen view events.

| Field | Type   | Optional | Description                   |
| ----- | ------ | -------- | ----------------------------- |
| name  | string | No       | The name of the screen viewed |

#### **`custom`**

Use the `custom` type for custom events.

| Field | Type   | Optional | Description                  |
| ----- | ------ | -------- | ---------------------------- |
| name  | string | No       | The name of the custom event |

### Traces

A **span** is the fundamental building block of a *trace*. Spans have the following shape illustrated with an
example of a `app_startup` span:

```jsonc
{
 "trace_id": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
 "span_id": "1234567890abcdef",
 "parent_id": null,
 "session_id": "633a2fbc-a0d1-4912-a92f-9e43e72afbc6",
 "name": "app_startup",
 "status": 0,
 "start_time": "2023-08-24T14:51:38.000000534Z",
 "end_time": "2023-08-24T14:51:38.000000834Z",
 "duration": 3000,
 "checkpoints": [
   {
     "name": "dagger_init_complete",
     "timestamp": "2023-08-24T14:51:38.000000634Z"
   }
 ],
 "attribute": {
   // snip attributes fields
 }
}
```

| Field         | Type     | Optional | Comment                                                                                                                            |
| ------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `trace_id`    | string   | No       | 16 bytes (128-bit) represented as 32 lowercase hex characters. Identifies a group of spans for an operation.                       |
| `span_id`     | string   | No       | 8 bytes (64-bit) represented as 16 lowercase hex characters. Unique identifier for a span in a trace.                              |
| `parent_id`   | string   | Yes      | Parent `span_id`, used to set a parent-child relationship between spans.                                                           |
| `name`        | string   | No       | The name of the span. Used to identify spans on the dashboard.                                                                     |
| `status`      | enum     | No       | One of:<br>- ok: 0<br>- error: 1<br><br>- unset: 2<br> Signifies operation success/failure.                                        |
| `start_time`  | datetime | No       | Nanosecond precision timestamp, e.g. "2023-08-24T14:51:38.000000534Z"                                                              |
| `end_time`    | datetime | No       | Nanosecond precision timestamp, e.g. "2023-08-24T14:51:38.000000834Z"                                                              |
| `duration`    | uint64   | No       | Duration of the span in milliseconds, calculated using a monotonic clock.                                                          |
| `checkpoints` | object   | Yes      | Named time markers within a span. Example: lifecycle events like `on_create`, `on_resume`.                                         |
| `attributes`  | object   | No       | Key-value pairs adding context to the span. Some attributes are automatically added while custom attributes can be set by clients. |

Spans can contain the following attributes, some of which are mandatory.

| Field                 | Type   | Optional | Comment                                                                     |
| --------------------- | ------ | -------- | --------------------------------------------------------------------------- |
| `installation_id`     | string | No       | A unique identifier for an installation of an app, generated by the client. |
| `app_version`         | string | No       | App version identifier                                                      |
| `app_build`           | string | No       | App build identifier                                                        |
| `app_unique_id`       | string | No       | App bundle identifier                                                       |
| `platform`            | string | No       | One of:<br>- android<br>- ios<br>- flutter                                  |
| `measure_sdk_version` | string | No       | Measure SDK version identifier                                              |
| `thread_name`         | string | Yes      | The thread on which the event was captured                                  |
| `user_id`             | string | Yes      | ID of the app's end user                                                    |
| `device_name`         | string | Yes      | Name of the device                                                          |
| `device_model`        | string | Yes      | Device model                                                                |
| `device_manufacturer` | string | Yes      | Name of the device manufacturer                                             |
| `device_type`         | string | Yes      | `phone` or `tablet`                                                         |
| `device_locale`       | string | Yes      | Locale based on RFC 5646, eg. en-US                                         |
| `os_name`             | string | Yes      | Operating system name                                                       |
| `os_version`          | string | Yes      | Operating system version                                                    |
| `os_page_size`        | uint8  | Yes      | Operating system memory page size                                           |
