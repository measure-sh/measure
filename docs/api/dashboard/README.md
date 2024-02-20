# Dashbaord REST API Documentation <!-- omit in toc -->

Find all the endpoints, resources and detailed documentation for Measure Dashboard REST APIs.

## Contents <!-- omit in toc -->

- [Apps](#apps)
  - [GET `/apps/:id/journey`](#get-appsidjourney)
    - [Usage Notes](#usage-notes)
    - [Authorization \& Content Type](#authorization--content-type)
    - [Response Body](#response-body)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting)
  - [GET `/apps/:id/metrics`](#get-appsidmetrics)
    - [Usage Notes](#usage-notes-1)
    - [Authorization \& Content Type](#authorization--content-type-1)
    - [Response Body](#response-body-1)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-1)
  - [GET `/apps/:id/filters`](#get-appsidfilters)
    - [Usage Notes](#usage-notes-2)
    - [Authorization \& Content Type](#authorization--content-type-2)
    - [Response Body](#response-body-2)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-2)
  - [GET `/apps/:id/crashGroups`](#get-appsidcrashgroups)
    - [Usage Notes](#usage-notes-3)
    - [Authorization \& Content Type](#authorization--content-type-3)
    - [Response Body](#response-body-3)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-3)
  - [GET `/apps/:id/anrGroups`](#get-appsidanrgroups)
    - [Usage Notes](#usage-notes-4)
    - [Authorization \& Content Type](#authorization--content-type-4)
    - [Response Body](#response-body-4)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-4)
  - [GET `/apps/:id/crashGroups/:id/crashes`](#get-appsidcrashgroupsidcrashes)
    - [Usage Notes](#usage-notes-5)
    - [Authorization \& Content Type](#authorization--content-type-5)
    - [Response Body](#response-body-5)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-5)
  - [GET `/apps/:id/anrGroups/:id/anrs`](#get-appsidanrgroupsidanrs)
    - [Usage Notes](#usage-notes-6)
    - [Authorization \& Content Type](#authorization--content-type-6)
    - [Response Body](#response-body-6)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-6)
- [Teams](#teams)
  - [GET `/teams`](#get-teams)
    - [Authorization \& Content Type](#authorization--content-type-7)
    - [Response Body](#response-body-7)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-7)
  - [GET `/teams/:id/apps`](#get-teamsidapps)
    - [Usage Notes](#usage-notes-7)
    - [Authorization \& Content Type](#authorization--content-type-8)
    - [Response Body](#response-body-8)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-8)
  - [GET `/teams/:id/apps/:id`](#get-teamsidappsid)
    - [Usage Notes](#usage-notes-8)
    - [Authorization \& Content Type](#authorization--content-type-9)
    - [Response Body](#response-body-9)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-9)
  - [POST `/teams/:id/apps`](#post-teamsidapps)
    - [Usage Notes](#usage-notes-9)
    - [Request body](#request-body)
    - [Authorization \& Content Type](#authorization--content-type-10)
    - [Response Body](#response-body-10)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-10)
  - [POST `/auth/invite`](#post-authinvite)
    - [Usage Notes](#usage-notes-10)
    - [Request body](#request-body-1)
    - [Authorization \& Content Type](#authorization--content-type-11)
    - [Response Body](#response-body-11)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-11)
  - [PATCH `/teams/:id/rename`](#patch-teamsidrename)
    - [Usage Notes](#usage-notes-11)
    - [Request body](#request-body-2)
    - [Authorization \& Content Type](#authorization--content-type-12)
    - [Response Body](#response-body-12)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-12)
  - [GET `/teams/:id/members`](#get-teamsidmembers)
    - [Usage Notes](#usage-notes-12)
    - [Authorization \& Content Type](#authorization--content-type-13)
    - [Response Body](#response-body-13)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-13)
  - [DELETE `/teams/:id/members/:id`](#delete-teamsidmembersid)
    - [Usage Notes](#usage-notes-13)
    - [Authorization \& Content Type](#authorization--content-type-14)
    - [Response Body](#response-body-14)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-14)
  - [PATCH `/teams/:id/members/:id`](#patch-teamsidmembersid)
    - [Usage Notes](#usage-notes-14)
    - [Request body](#request-body-3)
    - [Authorization \& Content Type](#authorization--content-type-15)
    - [Response Body](#response-body-15)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-15)
  - [GET `/teams/:id/authz`](#get-teamsidauthz)
    - [Usage Notes](#usage-notes-15)
    - [Authorization \& Content Type](#authorization--content-type-16)
    - [Response Body](#response-body-16)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-16)

## Apps

- [**GET `/apps/:id/journey`**](#get-appsidjourney) - Fetch an app's issue journey map for a time range &amp; version.
- [**GET `/apps/:id/metrics`**](#get-appsidmetrics) - Fetch an app's health metrics for a time range &amp; version.
- [**GET `/apps/:id/filters`**](#get-appsidfilters) - Fetch an app's filters.
- [**GET `/apps/:id/crashGroups`**](#get-appsidcrashgroups) - Fetch list of crash groups for an app
- [**GET `/apps/:id/anrGroups`**](#get-appsidanrgroups) - Fetch list of ANR groups for an app
- [**GET `/apps/:id/crashGroups/:id/crashes`**](#get-appsidcrashgroupsidcrashes) - Fetch list of crashes for a crash group
- [**GET `/apps/:id/anrGroups/:id/anrs`**](#get-appsidanrgroupsidanrs) - Fetch list of anrs for an anr group

### GET `/apps/:id/journey`

Fetch an app's issue journey map. Filter time range using `from` &amp; `to` query string parameters. Filter version using `version` query string parameter.

#### Usage Notes

- App's UUID must be passed in the URI
- All filters must be passed as query strings
- All filters are optional. If any filter is not present, the server will compute results assuming a default value for that filter.
- `from` &amp; `to` values must be ISO 8601 UTC strings in milliseconds precision. Example: `?from=2023-11-01T18:30:00.000Z&to=2023-11-08T18:30:00.000Z`
- `from` &amp; `to` will default to a last 7 days time range.
- `version` will default to the app's latest version.

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "nodes": [
      {
        "id": "Home Screen",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
      {
        "id": "Order History",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
      {
        "id": "Order Status",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
      {
        "id": "Support",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
      {
        "id": "List Of Items",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
      {
        "id": "Sales Offer",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
      {
        "id": "View Item Images",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
      {
        "id": "View Item Detail",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
      {
        "id": "Cyber Monday Sale Items List",
        "nodeColor": "hsl(0, 72%, 51%)",
        "issues": {
          "crashes": [
            {
              "title": "NullPointerException.java",
              "count": 37893
            },
            {
              "title": "LayoutInflaterException.java",
              "count": 12674
            }
          ],
          "anrs": [
            {
              "title": "CyberMondayActivity.java",
              "count": 97321
            },
            {
              "title": "CyberMondayFragment.kt",
              "count": 8005
            }
          ]
        }
      },
      {
        "id": "Add To Cart",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
      {
        "id": "Pay",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
      {
        "id": "Explore Discounts",
        "nodeColor": "hsl(142, 69%, 58%)",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      }
    ],
    "links": [
      {
        "source": "Home Screen",
        "target": "Order History",
        "value": 50000
      },
      {
        "source": "Home Screen",
        "target": "List Of Items",
        "value": 73356
      },
      {
        "source": "Home Screen",
        "target": "Cyber Monday Sale Items List",
        "value": 97652
      },
      {
        "source": "Order History",
        "target": "Order Status",
        "value": 9782
      },
      {
        "source": "Order History",
        "target": "Support",
        "value": 2837
      },
      {
        "source": "List Of Items",
        "target": "Sales Offer",
        "value": 14678
      },
      {
        "source": "List Of Items",
        "target": "View Item Detail",
        "value": 23654
      },
      {
        "source": "Cyber Monday Sale Items List",
        "target": "View Item Detail",
        "value": 43889
      },
      {
        "source": "Cyber Monday Sale Items List",
        "target": "Explore Discounts",
        "value": 34681
      },
      {
        "source": "Sales Offer",
        "target": "View Item Images",
        "value": 12055
      },
      {
        "source": "View Item Detail",
        "target": "View Item Images",
        "value": 16793
      },
      {
        "source": "View Item Detail",
        "target": "Add To Cart",
        "value": 11537
      },
      {
        "source": "Add To Cart",
        "target": "Pay",
        "value": 10144
      },
      {
        "source": "Add To Cart",
        "target": "Explore Discounts",
        "value": 4007
      }
    ]
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>


### GET `/apps/:id/metrics`

Fetch an app's health metrics. Filter time range using `from` &amp; `to` query string parameters. Filter version using `version` query string parameter.

#### Usage Notes

- App's UUID must be passed in the URI
- All filters must be passed as query strings
- All filters are optional. If any filter is not present, the server will compute results assuming a default value for that filter.
- `from` &amp; `to` values must be ISO 8601 UTC strings in milliseconds precision. Example: `?from=2023-11-01T18:30:00.000Z&to=2023-11-08T18:30:00.000Z`
- `from` &amp; `to` will default to a last 7 days time range.
- `version` will default to the app's latest version.

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "adoption": {
      "users": 49000,
      "totalUsers": 200000,
      "value": 28
    },
    "app_size": {
      "value": 20,
      "delta": 3.18
    },
    "crash_free_users": {
      "value": 98.2,
      "delta": 0.71
    },
    "perceived_crash_free_users": {
      "value": 92.8,
      "delta": -0.81
    },
    "multiple_crash_free_users": {
      "value": 75.49,
      "delta": 0.38
    },
    "anr_free_users": {
      "value": 98.3,
      "delta": 0.43
    },
    "perceived_anr_free_users": {
      "value": 91.9,
      "delta": 0.77
    },
    "multiple_anr_free_users": {
      "value": 97.26,
      "delta": -2.85
    },
    "app_cold_launch": {
      "value": 937,
      "delta": 34
    },
    "app_warm_launch": {
      "value": 600,
      "delta": -87
    },
    "app_hot_launch": {
      "value": 250,
      "delta": -55
    }
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/apps/:id/filters`

Fetch an app's filters. 

#### Usage Notes

- App's UUID must be passed in the URI

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "versions": [
      "1.0"
    ],
    "countries": [
      "bogon"
    ],
    "network_providers": null,
    "network_types": [
      "wifi"
    ],
    "network_generations": null,
    "locales": [
      "en-US"
    ],
    "device_manufacturers": [
      "Google"
    ],
    "device_names": [
      "sunfish"
    ]
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/apps/:id/crashGroups`

Fetch a list of crash groups for an app.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` (_optional_) - Start time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `to` (_optional_) - End time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only those crash groups that have events matching the version.
  - `key_id` (_optional_) - UUID of the last item. Used for keyset based pagination. Should be used along with `limit`.
  - `limit` (_optional_) - Number of items to return. Used for keyset based pagination. Should be used along with `key_id`. Negative values traverses backward along with `limit`.

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "meta": {
      "next": true,
      "previous": false
    },
    "results": [
      {
        "id": "018da688-071c-7207-a1fe-ef529bde9963",
        "app_id": "45b3788e-2226-4f39-9e3c-710016c6c075",
        "name": "java.lang.StackOverflowError",
        "fingerprint": "eb6ac85cc04117f9",
        "count": 2,
        "percentage_contribution": 25,
        "created_at": "2024-02-14T07:32:29.084Z",
        "updated_at": "2024-02-14T07:32:44.603Z"
      },
      {
        "id": "018da688-13e1-76db-8ad7-632401256db3",
        "app_id": "45b3788e-2226-4f39-9e3c-710016c6c075",
        "name": "java.lang.IllegalAccessException",
        "fingerprint": "c3f8c85cc0c117f9",
        "count": 2,
        "percentage_contribution": 25,
        "created_at": "2024-02-14T07:32:32.353Z",
        "updated_at": "2024-02-14T07:32:51.035Z"
      }
    ]
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/apps/:id/anrGroups`

Fetch a list of ANR groups for an app.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` (_optional_) - Start time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `to` (_optional_) - End time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only those crash groups that have events matching the version.
  - `key_id` (_optional_) - UUID of the last item. Used for keyset based pagination. Should be used along with `limit`.
  - `limit` (_optional_) - Number of items to return. Used for keyset based pagination. Should be used along with `key_id`. Negative values traverses backward along with `limit`.

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "meta": {
      "next": false,
      "previous": false
    },
    "results": [
      {
        "id": "018da687-f827-71d7-a136-0d3674e57943",
        "app_id": "45b3788e-2226-4f39-9e3c-710016c6c075",
        "name": "sh.measure.android.anr.AnrError",
        "fingerprint": "a97a4d1c40613ffb",
        "count": 2,
        "percentage_contribution": 50,
        "created_at": "2024-02-14T07:32:25.255Z",
        "updated_at": "2024-02-14T07:33:03.679Z"
      },
      {
        "id": "018da688-209a-739e-a7d2-6116fdc5ca6d",
        "app_id": "45b3788e-2226-4f39-9e3c-710016c6c075",
        "name": "c4.c",
        "fingerprint": "c378c85cc0c113f9",
        "count": 2,
        "percentage_contribution": 50,
        "created_at": "2024-02-14T07:32:35.61Z",
        "updated_at": "2024-02-14T07:33:03.679Z"
      }
    ]
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes &amp; Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/apps/:id/crashGroups/:id/crashes`

Fetch list of crashes of a crash group for an app.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` (_optional_) - ISO8601 timestamp to include crashes after this time.
  - `to` (_optional_) - ISO8601 timestamp to include crashes before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only those crash groups that have events matching the version.
  - `key_id` (_optional_) - UUID of the last item. Used for keyset based pagination. Should be used along with `key_timestamp` &amp; `limit`.
  - `key_timestamp` (_optional_) - ISO8601 timestamp of the last item. Used for keyset based pagination. Should be used along with `key_id` &amp; `limit`.
  - `limit` (_optional_) - Number of items to return. Used for keyset based pagination. Should be used along with `key_id` &amp; `key_timestamp`.

#### Authorization &amp; Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "meta": {
      "next": true,
      "previous": false
    },
    "results": [
      {
        "id": "ed32705d-074a-4deb-87f7-96449bb63e06",
        "timestamp": "2024-01-01T09:11:23.884Z",
        "type": "exception",
        "thread_name": "main",
        "resource": {
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
          "os_name": "android",
          "os_version": "33",
          "platform": "android",
          "app_version": "2.7.50464-dev-2024-01-01",
          "app_build": "50464",
          "app_unique_id": "org.wikipedia.dev",
          "measure_sdk_version": "0.0.1-SNAPSHOT",
          "network_type": "wifi",
          "network_generation": "",
          "network_provider": ""
        },
        "exceptions": [
          {
            "type": "org.wikipedia.CustomException",
            "message": "Custom Exception",
            "location": "org.wikipedia.feed.FeedFragment$FeedCallback.onVoiceSearchRequested(FeedFragment.kt:246)",
            "stacktrace": "org.wikipedia.CustomException\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:558)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\n\tat org.wikipedia.feed.FeedFragment$FeedCallback.onVoiceSearchRequested(FeedFragment.kt:246)\n\tat org.wikipedia.feed.searchbar.SearchCardView._init_$lambda$1(SearchCardView.kt:26)\n\tat android.view.View.performClick(View.java:7542)\n\tat android.view.View.performClickInternal(View.java:7519)\n\tat android.view.View.-$$Nest$mperformClickInternal\n\tat android.view.View$PerformClick.run(View.java:29476)\n\tat android.os.Handler.handleCallback(Handler.java:942)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7918)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\n"
          }
        ],
        "threads": [
          {
            "name": "ReferenceQueueDaemon",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:386)",
              "java.lang.Object.wait(Object.java:524)",
              "java.lang.Daemons$ReferenceQueueDaemon.runInternal(Daemons.java:239)",
              "java.lang.Daemons$Daemon.run(Daemons.java:145)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "Firebase-Messaging-Topics-Io",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:341)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode.block(AbstractQueuedSynchronizer.java:506)",
              "java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3466)",
              "java.util.concurrent.ForkJoinPool.managedBlock(ForkJoinPool.java:3437)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1623)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1176)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1071)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1131)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "com.google.android.gms.common.util.concurrent.zza.run(com.google.android.gms:play-services-basement@@18.1.0:2)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "ConnectivityThread",
            "frames": [
              "android.os.MessageQueue.nativePollOnce(MessageQueue.java:-2)",
              "android.os.MessageQueue.next(MessageQueue.java:335)",
              "android.os.Looper.loopOnce(Looper.java:161)",
              "android.os.Looper.loop(Looper.java:288)",
              "android.os.HandlerThread.run(HandlerThread.java:67)"
            ]
          },
          {
            "name": "EmojiCompatInitializer",
            "frames": [
              "java.lang.ThreadLocal.getMap(ThreadLocal.java:254)",
              "java.lang.ThreadLocal.get(ThreadLocal.java:163)",
              "androidx.emoji2.text.EmojiMetadata.getMetadataItem(EmojiMetadata.java:132)",
              "androidx.emoji2.text.EmojiMetadata.getId(EmojiMetadata.java:152)",
              "androidx.emoji2.text.MetadataRepo.constructIndex(MetadataRepo.java:166)",
              "androidx.emoji2.text.MetadataRepo.<init>(MetadataRepo.java:80)",
              "androidx.emoji2.text.MetadataRepo.create(MetadataRepo.java:130)",
              "androidx.emoji2.text.FontRequestEmojiCompatConfig$FontRequestMetadataLoader.createMetadata(FontRequestEmojiCompatConfig.java:386)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxCachedWorkerPoolEvictor-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:1672)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1071)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1131)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "measure-thread-#0",
            "frames": [
              "kotlin.jvm.internal.Intrinsics.checkNotNullParameter(Intrinsics.java:130)",
              "kotlinx.serialization.json.JsonElementSerializer.serialize(JsonElementSerializers.kt)",
              "kotlinx.serialization.json.JsonElementSerializer.serialize(JsonElementSerializers.kt:27)",
              "kotlinx.serialization.json.internal.PolymorphicKt.encodePolymorphically(Polymorphic.kt:21)",
              "kotlinx.serialization.json.internal.StreamingJsonEncoder.encodeSerializableValue(StreamingJsonEncoder.kt:66)",
              "kotlinx.serialization.encoding.AbstractEncoder.encodeSerializableElement(AbstractEncoder.kt:80)",
              "java.util.concurrent.FutureTask.run(FutureTask.java:264)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$ScheduledFutureTask.run(ScheduledThreadPoolExecutor.java:307)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "CrAsyncTask #2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:1672)",
              "java.util.concurrent.ArrayBlockingQueue.poll(ArrayBlockingQueue.java:435)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1131)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "WM.task-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:341)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode.block(AbstractQueuedSynchronizer.java:506)",
              "java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3466)",
              "java.util.concurrent.ForkJoinPool.managedBlock(ForkJoinPool.java:3437)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1623)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:435)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1071)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1131)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp Dispatcher",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:401)",
              "java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:903)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1131)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "queued-work-looper",
            "frames": [
              "android.os.MessageQueue.nativePollOnce(MessageQueue.java:-2)",
              "android.os.MessageQueue.next(MessageQueue.java:335)",
              "android.os.Looper.loopOnce(Looper.java:161)",
              "android.os.Looper.loop(Looper.java:288)",
              "android.os.HandlerThread.run(HandlerThread.java:67)"
            ]
          }
        ],
        "attributes": {}
      },
      {
        "id": "ab186b0d-cbe6-420b-9ca9-4f1f932203e4",
        "timestamp": "2024-01-01T09:11:18.947Z",
        "type": "exception",
        "thread_name": "main",
        "resource": {
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
          "os_name": "android",
          "os_version": "33",
          "platform": "android",
          "app_version": "2.7.50464-dev-2024-01-01",
          "app_build": "50464",
          "app_unique_id": "org.wikipedia.dev",
          "measure_sdk_version": "0.0.1-SNAPSHOT",
          "network_type": "wifi",
          "network_generation": "",
          "network_provider": ""
        },
        "exceptions": [
          {
            "type": "org.wikipedia.CustomException",
            "message": "Custom Exception",
            "location": "org.wikipedia.feed.FeedFragment$FeedCallback.onVoiceSearchRequested(FeedFragment.kt:246)",
            "stacktrace": "org.wikipedia.CustomException\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:558)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\n\tat org.wikipedia.feed.FeedFragment$FeedCallback.onVoiceSearchRequested(FeedFragment.kt:246)\n\tat org.wikipedia.feed.searchbar.SearchCardView._init_$lambda$1(SearchCardView.kt:26)\n\tat android.view.View.performClick(View.java:7542)\n\tat android.view.View.performClickInternal(View.java:7519)\n\tat android.view.View.-$$Nest$mperformClickInternal\n\tat android.view.View$PerformClick.run(View.java:29476)\n\tat android.os.Handler.handleCallback(Handler.java:942)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7918)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\n"
          }
        ],
        "threads": [
          {
            "name": "Okio Watchdog",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1757)",
              "okio.AsyncTimeout$Companion.awaitTimeout$okio(AsyncTimeout.kt:308)",
              "okio.AsyncTimeout$Watchdog.run(AsyncTimeout.kt:186)"
            ]
          },
          {
            "name": "FinalizerDaemon",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:386)",
              "java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:210)",
              "java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:231)",
              "java.lang.Daemons$FinalizerDaemon.runInternal(Daemons.java:309)",
              "java.lang.Daemons$Daemon.run(Daemons.java:145)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp en.wikipedia.org",
            "frames": [
              "java.net.SocketInputStream.socketRead0(SocketInputStream.java:-2)",
              "java.net.SocketInputStream.socketRead(SocketInputStream.java:118)",
              "java.net.SocketInputStream.read(SocketInputStream.java:173)",
              "java.net.SocketInputStream.read(SocketInputStream.java:143)",
              "com.android.org.conscrypt.ConscryptEngineSocket$SSLInputStream.readFromSocket(ConscryptEngineSocket.java:983)",
              "com.android.org.conscrypt.ConscryptEngineSocket$SSLInputStream.processDataFromSocket(ConscryptEngineSocket.java:947)",
              "com.android.org.conscrypt.ConscryptEngineSocket$SSLInputStream.readUntilDataAvailable(ConscryptEngineSocket.java:862)",
              "com.android.org.conscrypt.ConscryptEngineSocket$SSLInputStream.read(ConscryptEngineSocket.java:835)",
              "okio.InputStreamSource.read(JvmOkio.kt:94)",
              "okio.AsyncTimeout$source$1.read(AsyncTimeout.kt:128)",
              "okio.internal._RealBufferedSourceKt.commonRequest(-RealBufferedSource.kt:60)",
              "okio.RealBufferedSource.request(RealBufferedSource.kt:68)",
              "okio.internal._RealBufferedSourceKt.commonRequire(-RealBufferedSource.kt:53)",
              "okio.RealBufferedSource.require(RealBufferedSource.kt:67)",
              "okhttp3.internal.http2.Http2Reader.nextFrame(Http2Reader.kt:89)",
              "okhttp3.internal.http2.Http2Connection$ReaderRunnable.invoke(Http2Connection.kt:618)",
              "okhttp3.internal.http2.Http2Connection$ReaderRunnable.invoke(Http2Connection.kt:609)",
              "okhttp3.internal.concurrent.TaskQueue$execute$1.runOnce(TaskQueue.kt:98)",
              "okhttp3.internal.concurrent.TaskRunner.runTask(TaskRunner.kt:116)",
              "okhttp3.internal.concurrent.TaskRunner.access$runTask(TaskRunner.kt:42)",
              "okhttp3.internal.concurrent.TaskRunner$runnable$1.run(TaskRunner.kt:65)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp Dispatcher",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:401)",
              "java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:903)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1131)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "glide-source-thread-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:341)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode.block(AbstractQueuedSynchronizer.java:506)",
              "java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3466)",
              "java.util.concurrent.ForkJoinPool.managedBlock(ForkJoinPool.java:3437)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1623)",
              "java.util.concurrent.PriorityBlockingQueue.take(PriorityBlockingQueue.java:538)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1071)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1131)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "com.bumptech.glide.load.engine.executor.GlideExecutor$DefaultThreadFactory$1.run(GlideExecutor.java:424)",
              "java.lang.Thread.run(Thread.java:1012)",
              "com.bumptech.glide.load.engine.executor.GlideExecutor$DefaultPriorityThreadFactory$1.run(GlideExecutor.java:383)"
            ]
          },
          {
            "name": "Firebase Background Thread #0",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:341)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode.block(AbstractQueuedSynchronizer.java:506)",
              "java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3466)",
              "java.util.concurrent.ForkJoinPool.managedBlock(ForkJoinPool.java:3437)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1623)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:435)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1071)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1131)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "com.google.firebase.concurrent.CustomThreadFactory.lambda$newThread$0(CustomThreadFactory.java:47)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "GoogleApiHandler",
            "frames": [
              "android.os.MessageQueue.nativePollOnce(MessageQueue.java:-2)",
              "android.os.MessageQueue.next(MessageQueue.java:335)",
              "android.os.Looper.loopOnce(Looper.java:161)",
              "android.os.Looper.loop(Looper.java:288)",
              "android.os.HandlerThread.run(HandlerThread.java:67)"
            ]
          },
          {
            "name": "ConnectivityThread",
            "frames": [
              "android.os.MessageQueue.nativePollOnce(MessageQueue.java:-2)",
              "android.os.MessageQueue.next(MessageQueue.java:335)",
              "android.os.Looper.loopOnce(Looper.java:161)",
              "android.os.Looper.loop(Looper.java:288)",
              "android.os.HandlerThread.run(HandlerThread.java:67)"
            ]
          },
          {
            "name": "OkHttp TaskRunner",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:401)",
              "java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:903)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1131)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "WM.task-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:341)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode.block(AbstractQueuedSynchronizer.java:506)",
              "java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3466)",
              "java.util.concurrent.ForkJoinPool.managedBlock(ForkJoinPool.java:3437)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1623)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:435)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1071)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1131)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          }
        ],
        "attributes": {}
      }
    ]
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes &amp; Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/apps/:id/anrGroups/:id/anrs`

Fetch list of anrs of an anr group for an app.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` (_optional_) - ISO8601 timestamp to include crashes after this time.
  - `to` (_optional_) - ISO8601 timestamp to include crashes before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only those anr groups that have events matching the version.
  - `key_id` (_optional_) - UUID of the last item. Used for keyset based pagination. Should be used along with `key_timestamp` &amp; `limit`.
  - `key_timestamp` (_optional_) - ISO8601 timestamp of the last item. Used for keyset based pagination. Should be used along with `key_id` &amp; `limit`.
  - `limit` (_optional_) - Number of items to return. Used for keyset based pagination. Should be used along with `key_id` &amp; `key_timestamp`.

#### Authorization &amp; Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "meta": {
      "next": false,
      "previous": true
    },
    "results": [
      {
        "id": "321f3281-e690-460d-a018-5c1211bcea8f",
        "timestamp": "2024-01-01T07:59:27.366Z",
        "type": "anr",
        "thread_name": "main",
        "resource": {
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
          "os_name": "android",
          "os_version": "33",
          "platform": "android",
          "app_version": "1.0",
          "app_build": "1",
          "app_unique_id": "sh.measure.sample",
          "measure_sdk_version": "0.0.1-SNAPSHOT",
          "network_type": "wifi",
          "network_generation": "",
          "network_provider": ""
        },
        "anrs": [
          {
            "type": "sh.measure.android.anr.AnrError",
            "message": "Application Not Responding for at least 5000 ms.",
            "location": "sh.measure.sample.ExceptionDemoActivity.infiniteLoop(ExceptionDemoActivity.kt:49)",
            "stacktrace": "sh.measure.android.anr.AnrError\n\tat sh.measure.sample.ExceptionDemoActivity.infiniteLoop(ExceptionDemoActivity.kt:49)\n\tat sh.measure.sample.ExceptionDemoActivity.onCreate$lambda$4(ExceptionDemoActivity.kt:38)\n\tat sh.measure.sample.ExceptionDemoActivity.$r8$lambda$3rHWr05q6AS4xKQVFee84ItKeF8\n\tat android.view.View.performClick(View.java:7542)\n\tat com.google.android.material.button.MaterialButton.performClick(MaterialButton.java:1211)\n\tat android.view.View.performClickInternal(View.java:7519)\n\tat android.view.View.-$$Nest$mperformClickInternal\n\tat android.view.View$PerformClick.run(View.java:29476)\n\tat android.os.Handler.handleCallback(Handler.java:942)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7918)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\n"
          }
        ],
        "threads": [
          {
            "name": "Thread-2",
            "frames": [
              "dalvik.system.VMStack.getThreadStackTrace(VMStack.java:-2)",
              "java.lang.Thread.getStackTrace(Thread.java:1841)",
              "java.lang.Thread.getAllStackTraces(Thread.java:1909)",
              "sh.measure.android.exceptions.ExceptionFactory.createMeasureException(ExceptionFactory.kt:41)",
              "sh.measure.android.anr.AnrCollector.toMeasureException(AnrCollector.kt:39)",
              "sh.measure.android.anr.AnrCollector.onAppNotResponding(AnrCollector.kt:34)",
              "sh.measure.android.anr.ANRWatchDog.run(ANRWatchDog.kt:100)"
            ]
          },
          {
            "name": "FinalizerDaemon",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:386)",
              "java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:210)",
              "java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:231)",
              "java.lang.Daemons$FinalizerDaemon.runInternal(Daemons.java:309)",
              "java.lang.Daemons$Daemon.run(Daemons.java:145)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "Okio Watchdog",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1757)",
              "okio.AsyncTimeout$Companion.awaitTimeout$okio(AsyncTimeout.kt:320)",
              "okio.AsyncTimeout$Watchdog.run(AsyncTimeout.kt:186)"
            ]
          },
          {
            "name": "LeakCanary-Heap-Dump",
            "frames": [
              "android.os.MessageQueue.nativePollOnce(MessageQueue.java:-2)",
              "android.os.MessageQueue.next(MessageQueue.java:335)",
              "android.os.Looper.loopOnce(Looper.java:161)",
              "android.os.Looper.loop(Looper.java:288)",
              "android.os.HandlerThread.run(HandlerThread.java:67)"
            ]
          },
          {
            "name": "OkHttp http://10.0.2.2:8080/...",
            "frames": [
              "libcore.io.Linux.poll(Linux.java:-2)",
              "libcore.io.ForwardingOs.poll(ForwardingOs.java:573)",
              "libcore.io.BlockGuardOs.poll(BlockGuardOs.java:283)",
              "libcore.io.ForwardingOs.poll(ForwardingOs.java:573)",
              "libcore.io.IoBridge.isConnected(IoBridge.java:326)",
              "libcore.io.IoBridge.connectErrno(IoBridge.java:237)",
              "libcore.io.IoBridge.connect(IoBridge.java:179)",
              "java.net.PlainSocketImpl.socketConnect(PlainSocketImpl.java:142)",
              "java.net.AbstractPlainSocketImpl.doConnect(AbstractPlainSocketImpl.java:390)",
              "java.net.AbstractPlainSocketImpl.connectToAddress(AbstractPlainSocketImpl.java:230)",
              "java.net.AbstractPlainSocketImpl.connect(AbstractPlainSocketImpl.java:212)",
              "java.net.SocksSocketImpl.connect(SocksSocketImpl.java:436)",
              "java.net.Socket.connect(Socket.java:646)",
              "okhttp3.internal.platform.Platform.connectSocket(Platform.kt:128)",
              "okhttp3.internal.connection.RealConnection.connectSocket(RealConnection.kt:295)",
              "okhttp3.internal.connection.RealConnection.connect(RealConnection.kt:207)",
              "okhttp3.internal.connection.ExchangeFinder.findConnection(ExchangeFinder.kt:226)",
              "okhttp3.internal.connection.ExchangeFinder.findHealthyConnection(ExchangeFinder.kt:106)",
              "okhttp3.internal.connection.ExchangeFinder.find(ExchangeFinder.kt:74)",
              "okhttp3.internal.connection.RealCall.initExchange$okhttp(RealCall.kt:255)",
              "okhttp3.internal.connection.ConnectInterceptor.intercept(ConnectInterceptor.kt:32)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.cache.CacheInterceptor.intercept(CacheInterceptor.kt:95)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.http.BridgeInterceptor.intercept(BridgeInterceptor.kt:83)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.http.RetryAndFollowUpInterceptor.intercept(RetryAndFollowUpInterceptor.kt:76)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.logging.HttpLoggingInterceptor.intercept(HttpLoggingInterceptor.kt:221)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "sh.measure.android.network.SecretTokenHeaderInterceptor.intercept(SecretTokenHeaderInterceptor.kt:16)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.connection.RealCall.getResponseWithInterceptorChain$okhttp(RealCall.kt:201)",
              "okhttp3.internal.connection.RealCall$AsyncCall.run(RealCall.kt:517)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp http://10.0.2.2:8080/...",
            "frames": [
              "libcore.io.Linux.poll(Linux.java:-2)",
              "libcore.io.ForwardingOs.poll(ForwardingOs.java:573)",
              "libcore.io.BlockGuardOs.poll(BlockGuardOs.java:283)",
              "libcore.io.ForwardingOs.poll(ForwardingOs.java:573)",
              "libcore.io.IoBridge.isConnected(IoBridge.java:326)",
              "libcore.io.IoBridge.connectErrno(IoBridge.java:237)",
              "libcore.io.IoBridge.connect(IoBridge.java:179)",
              "java.net.PlainSocketImpl.socketConnect(PlainSocketImpl.java:142)",
              "java.net.AbstractPlainSocketImpl.doConnect(AbstractPlainSocketImpl.java:390)",
              "java.net.AbstractPlainSocketImpl.connectToAddress(AbstractPlainSocketImpl.java:230)",
              "java.net.AbstractPlainSocketImpl.connect(AbstractPlainSocketImpl.java:212)",
              "java.net.SocksSocketImpl.connect(SocksSocketImpl.java:436)",
              "java.net.Socket.connect(Socket.java:646)",
              "okhttp3.internal.platform.Platform.connectSocket(Platform.kt:128)",
              "okhttp3.internal.connection.RealConnection.connectSocket(RealConnection.kt:295)",
              "okhttp3.internal.connection.RealConnection.connect(RealConnection.kt:207)",
              "okhttp3.internal.connection.ExchangeFinder.findConnection(ExchangeFinder.kt:226)",
              "okhttp3.internal.connection.ExchangeFinder.findHealthyConnection(ExchangeFinder.kt:106)",
              "okhttp3.internal.connection.ExchangeFinder.find(ExchangeFinder.kt:74)",
              "okhttp3.internal.connection.RealCall.initExchange$okhttp(RealCall.kt:255)",
              "okhttp3.internal.connection.ConnectInterceptor.intercept(ConnectInterceptor.kt:32)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.cache.CacheInterceptor.intercept(CacheInterceptor.kt:95)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.http.BridgeInterceptor.intercept(BridgeInterceptor.kt:83)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.http.RetryAndFollowUpInterceptor.intercept(RetryAndFollowUpInterceptor.kt:76)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.logging.HttpLoggingInterceptor.intercept(HttpLoggingInterceptor.kt:221)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "sh.measure.android.network.SecretTokenHeaderInterceptor.intercept(SecretTokenHeaderInterceptor.kt:16)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.connection.RealCall.getResponseWithInterceptorChain$okhttp(RealCall.kt:201)",
              "okhttp3.internal.connection.RealCall$AsyncCall.run(RealCall.kt:517)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "ConnectivityThread",
            "frames": [
              "android.os.MessageQueue.nativePollOnce(MessageQueue.java:-2)",
              "android.os.MessageQueue.next(MessageQueue.java:335)",
              "android.os.Looper.loopOnce(Looper.java:161)",
              "android.os.Looper.loop(Looper.java:288)",
              "android.os.HandlerThread.run(HandlerThread.java:67)"
            ]
          },
          {
            "name": "OkHttp http://10.0.2.2:8080/...",
            "frames": [
              "libcore.io.Linux.poll(Linux.java:-2)",
              "libcore.io.ForwardingOs.poll(ForwardingOs.java:573)",
              "libcore.io.BlockGuardOs.poll(BlockGuardOs.java:283)",
              "libcore.io.ForwardingOs.poll(ForwardingOs.java:573)",
              "libcore.io.IoBridge.isConnected(IoBridge.java:326)",
              "libcore.io.IoBridge.connectErrno(IoBridge.java:237)",
              "libcore.io.IoBridge.connect(IoBridge.java:179)",
              "java.net.PlainSocketImpl.socketConnect(PlainSocketImpl.java:142)",
              "java.net.AbstractPlainSocketImpl.doConnect(AbstractPlainSocketImpl.java:390)",
              "java.net.AbstractPlainSocketImpl.connectToAddress(AbstractPlainSocketImpl.java:230)",
              "java.net.AbstractPlainSocketImpl.connect(AbstractPlainSocketImpl.java:212)",
              "java.net.SocksSocketImpl.connect(SocksSocketImpl.java:436)",
              "java.net.Socket.connect(Socket.java:646)",
              "okhttp3.internal.platform.Platform.connectSocket(Platform.kt:128)",
              "okhttp3.internal.connection.RealConnection.connectSocket(RealConnection.kt:295)",
              "okhttp3.internal.connection.RealConnection.connect(RealConnection.kt:207)",
              "okhttp3.internal.connection.ExchangeFinder.findConnection(ExchangeFinder.kt:226)",
              "okhttp3.internal.connection.ExchangeFinder.findHealthyConnection(ExchangeFinder.kt:106)",
              "okhttp3.internal.connection.ExchangeFinder.find(ExchangeFinder.kt:74)",
              "okhttp3.internal.connection.RealCall.initExchange$okhttp(RealCall.kt:255)",
              "okhttp3.internal.connection.ConnectInterceptor.intercept(ConnectInterceptor.kt:32)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.cache.CacheInterceptor.intercept(CacheInterceptor.kt:95)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.http.BridgeInterceptor.intercept(BridgeInterceptor.kt:83)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.http.RetryAndFollowUpInterceptor.intercept(RetryAndFollowUpInterceptor.kt:76)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.logging.HttpLoggingInterceptor.intercept(HttpLoggingInterceptor.kt:221)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "sh.measure.android.network.SecretTokenHeaderInterceptor.intercept(SecretTokenHeaderInterceptor.kt:16)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.connection.RealCall.getResponseWithInterceptorChain$okhttp(RealCall.kt:201)",
              "okhttp3.internal.connection.RealCall$AsyncCall.run(RealCall.kt:517)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp http://10.0.2.2:8080/...",
            "frames": [
              "libcore.io.Linux.poll(Linux.java:-2)",
              "libcore.io.ForwardingOs.poll(ForwardingOs.java:573)",
              "libcore.io.BlockGuardOs.poll(BlockGuardOs.java:283)",
              "libcore.io.ForwardingOs.poll(ForwardingOs.java:573)",
              "libcore.io.IoBridge.isConnected(IoBridge.java:326)",
              "libcore.io.IoBridge.connectErrno(IoBridge.java:237)",
              "libcore.io.IoBridge.connect(IoBridge.java:179)",
              "java.net.PlainSocketImpl.socketConnect(PlainSocketImpl.java:142)",
              "java.net.AbstractPlainSocketImpl.doConnect(AbstractPlainSocketImpl.java:390)",
              "java.net.AbstractPlainSocketImpl.connectToAddress(AbstractPlainSocketImpl.java:230)",
              "java.net.AbstractPlainSocketImpl.connect(AbstractPlainSocketImpl.java:212)",
              "java.net.SocksSocketImpl.connect(SocksSocketImpl.java:436)",
              "java.net.Socket.connect(Socket.java:646)",
              "okhttp3.internal.platform.Platform.connectSocket(Platform.kt:128)",
              "okhttp3.internal.connection.RealConnection.connectSocket(RealConnection.kt:295)",
              "okhttp3.internal.connection.RealConnection.connect(RealConnection.kt:207)",
              "okhttp3.internal.connection.ExchangeFinder.findConnection(ExchangeFinder.kt:226)",
              "okhttp3.internal.connection.ExchangeFinder.findHealthyConnection(ExchangeFinder.kt:106)",
              "okhttp3.internal.connection.ExchangeFinder.find(ExchangeFinder.kt:74)",
              "okhttp3.internal.connection.RealCall.initExchange$okhttp(RealCall.kt:255)",
              "okhttp3.internal.connection.ConnectInterceptor.intercept(ConnectInterceptor.kt:32)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.cache.CacheInterceptor.intercept(CacheInterceptor.kt:95)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.http.BridgeInterceptor.intercept(BridgeInterceptor.kt:83)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.http.RetryAndFollowUpInterceptor.intercept(RetryAndFollowUpInterceptor.kt:76)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.logging.HttpLoggingInterceptor.intercept(HttpLoggingInterceptor.kt:221)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "sh.measure.android.network.SecretTokenHeaderInterceptor.intercept(SecretTokenHeaderInterceptor.kt:16)",
              "okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)",
              "okhttp3.internal.connection.RealCall.getResponseWithInterceptorChain$okhttp(RealCall.kt:201)",
              "okhttp3.internal.connection.RealCall$AsyncCall.run(RealCall.kt:517)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          }
        ],
        "attributes": {}
      }
    ]
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes &amp; Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

## Teams

- [**GET `/teams`**](#get-teams) - Fetch list of teams of currently logged in user
- [**GET `/teams/:id/apps`**](#get-teamsidapps) - Fetch list of apps for a team
- [**GET `/teams/:id/apps/:id`**](#get-teamsidappsid) - Fetch details of an app for a team
- [**POST `/teams/:id/apps`**](#post-teamsidapps) - Create a new app for a team
- [**POST `/teams/:id/invite`**](#post-teamsidinvite) - Invite new members (both existing & non measure users) to a team
- [**PATCH `/teams/:id/rename`**](#patch-teamsidrename) -  Rename a team
- [**GET `/teams/:id/members`**](#get-teamsidmembers) -  Fetch list of team members for a team
- [**DELETE `/teams/:id/members/:id`**](#delete-teamsidmembersid) -  Remove a member from a team
- [**PATCH `/teams/:id/members/:id`**](#patch-teamsidmembersid) -  Change role of a member of a team
- [**GET `/teams/:id/authz`**](#get-teamsidauthz) -  Fetch authorization details of currently logged in user for a team -->

### GET `/teams`

Fetch list of teams of currently logged in user

#### Authorization &amp; Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  [
    {
        "id": "099f0f9b-5ee9-47de-a8aa-e996adc049c1",
        "name": "Team 1",
        "role": "owner"
    },
    {
        "id": "823f0g9c-2gg7-32mp-x6cj-v368geb129d0",
        "name": "Team 2",
        "role": "admin"
    }
  ]
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes &amp; Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/teams/:id/apps`

Fetch list of apps for a team

#### Usage Notes

- Teams's UUID must be passed in the URI
- The `onboarded` flag in the response indicates whether this app has received it's first session
- The `unique_identifier` field in the response is the package name or bundle id of the app
- The `api_key` field in the response is the key used by the client SDK to send data
- The `revoked` field in the `api_key` object in the response indicates whether the API key is valid or has been revoked due to security issues

#### Authorization &amp; Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  [
    {
        "id": "3dd90264-6be7-420f-aaf7-3f39a7588b0c",
        "team_id": "099f0f9b-5ee9-47de-a8aa-e996adc049c1",
        "name": "App 1",
        "api_key": {
            "created_at": "2024-01-19T06:16:00.896Z",
            "key": "msrsh_a235c69a0e9550d9d4bec7c6cdce653982cb452d8b6cb1f46875329c7ea7c3f4_abdb5a57",
            "last_seen": null,
            "revoked": false
        },
        "onboarded": false,
        "created_at": "2024-01-19T06:16:00.894744Z",
        "updated_at": "2024-01-19T06:16:00.894744Z",
        "platform": null,
        "onboarded_at": null,
        "unique_identifier": null
    },
    {
        "id": "a8367cc5-be17-4854-bb58-bb05e53e9a8c",
        "team_id": "099f0f9b-5ee9-47de-a8aa-e996adc049c1",
        "name": "App 2",
        "api_key": {
            "created_at": "2024-01-17T08:22:36.547Z",
            "key": "msrsh_d294b2f7f27eb9068b76d44ca4cbf67f5e192fda7075655cec311926acd145b4_2f7e56f9",
            "last_seen": null,
            "revoked": false
        },
        "onboarded": true,
        "created_at": "2024-01-17T08:22:36.540065Z",
        "updated_at": "2024-01-17T08:22:36.540065Z",
        "platform": "android",
        "onboarded_at": "2024-01-18T08:00:14.007865Z",
        "unique_identifier": "sh.measure.app2"
    }
  ]
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/teams/:id/apps/:id`

Fetch details of an app for a team

#### Usage Notes

- Teams's UUID must be passed in the URI as the first ID
- Apps's UUID must be passed in the URI as the second ID
- The `onboarded` flag in the response indicates whether this app has received it's first session
- The `unique_identifier` field in the response is the package name or bundle id of the app
- The `api_key` field in the response is the key used by the client SDK to send data
- The `revoked` field in the `api_key` object in the response indicates whether the API key is valid or has been revoked due to security issues

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "id": "349ae6bb-deda-43a0-bee5-a0c8910872ab",
    "team_id": "9e139caa-27b5-4d22-a190-f13167ca14fe",
    "name": "App 1",
    "api_key": {
      "created_at": "2024-01-17T11:01:09.323Z",
      "key": "msrsh_d581058a398a021be561a46c9b92458f618a8a9cd3fed47fc8255b3c2be6b646_57cf688e",
      "last_seen": null,
      "revoked": false
    },
    "onboarded": true,
    "created_at": "2024-01-17T11:01:09.319248Z",
    "updated_at": "2024-01-18T08:00:14.007865Z",
    "platform": "android",
    "onboarded_at": "2024-01-18T08:00:14.007865Z",
    "unique_identifier": "sh.measure.app1"
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### POST `/teams/:id/apps`

Create a new app for a team

#### Usage Notes

- Teams's UUID must be passed in the URI
- The app name of the new app must be passed in the request body
- The `onboarded` flag in the response indicates whether this app has received it's first session
- The `unique_identifier` field in the response is the package name or bundle id of the app
- The `api_key` field in the response is the key used by the client SDK to send data
- The `revoked` field in the `api_key` object in the response indicates whether the API key is valid or has been revoked due to security issues

#### Request body

```json
{
  "name": "App 3"
}
```

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "id": "a787cbd6-1c94-4ffb-9cf9-f2fe0c4ebdeb",
    "team_id": "099f0f9b-5ee9-47de-a8aa-e996adc049c1",
    "name": "App 3",
    "api_key": {
        "created_at": "2024-01-19T06:40:37.489Z",
        "key": "msrsh_9d33956c945c386ea69790eab71550b955b09aa3dae9e1130d2d9fca6ea783b9_937e81c4",
        "last_seen": null,
        "revoked": false
    },
    "onboarded": false,
    "created_at": "2024-01-19T06:40:37.483752508Z",
    "updated_at": "2024-01-19T06:40:37.483752508Z",
    "platform": null,
    "onboarded_at": null,
    "unique_identifier": null
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `201 Created`               | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### POST `/auth/invite`

Invite new members (both existing & non measure users) to a team

#### Usage Notes

- The email id of the user to be invited, team ID and role of the user to be invited must be passed in the request body
- If a invited user does not have a measure account, they will get an invite email to sign up and will be added to team post signup automatically
- If invited user already has a measure acccount, they will be added to the team immediately

#### Request body

```json
[
  {
    "email": "newuser@gmail.com",
    "role": "admin",
    "teamId": "099f0f9b-5ee9-47de-a8aa-e996adc049c1",
  }
]
```

#### Authorization & Content Type

1. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "ok":"invited newuser@gmail.com"
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### PATCH `/teams/:id/rename`

Rename a team

#### Usage Notes

- Teams's UUID must be passed in the URI
- The new name of the team must be passed in the request body

#### Request body

```json
{
  "name": "Team 2"
}
```

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "ok":"team was renamed"
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/teams/:id/members`

Fetch list of team members for a team

#### Usage Notes

- Teams's UUID must be passed in the URI

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  [
    {
      "id": "7737299c-82cb-4769-8fed-b313a230aa9d",
      "name": "User 1",
      "email": "user1@gmail.com",
      "role": "owner",
      "last_sign_in_at": "2024-01-19T06:11:47.928Z",
      "created_at": "2024-01-17T08:22:28.274Z"
    },
    {
      "id": "a787cbd6-1c94-4ffb-9cf9-f2fe0c4ebdeb",
      "name": "User 2",
      "email": "user2@gmail.com",
      "role": "admin",
      "last_sign_in_at": "2024-01-19T03:09:47.928Z",
      "created_at": "2024-01-17T04:21:23.274Z"
    }
  ]
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### DELETE `/teams/:id/members/:id`

Remove a member from a team

#### Usage Notes

- Teams's UUID must be passed in the URI as the first ID
- Members's UUID must be passed in the URI as the second ID

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "ok": "removed member [f0ee4474-bcde-4d3f-979d-bbf36f2d66b7] from team [099f0f9b-5ee9-47de-a8aa-e996adc049c1]"
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### PATCH `/teams/:id/members/:id`

Change role of a member of a team

#### Usage Notes

- Teams's UUID must be passed in the URI as the first ID
- Members's UUID must be passed in the URI as the second ID

#### Request body

```json
{
  "role": "developer"
}
```

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "ok" : "done"
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/teams/:id/authz`

Fetch authorization details of currently logged in user for a team

#### Usage Notes

- Teams's UUID must be passed in the URI
- The `can_invite` field in the response indicates what roles new team members can be invited as by the current user
- The `can_change_roles` field in the `authz` field in the response indicates what roles the current user is allowed to assign for that particular member
- The `can_remove` flag in the `authz` field in the response indicates whether the current user is allowed to remove that particular member from the team

#### Authorization & Content Type

1. Set the user's access token in `Authorization: Bearer <access-token>` format

2. Set content type as `Content-Type: application/json; charset=utf-8`

These headers must be present in each request.

<details>
<summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "can_invite": [
        "owner",
        "admin",
        "developer",
        "viewer"
    ],
    "members": [
        {
            "id": "7737299c-82cb-4769-8fed-b313a230aa9d",
            "name": "User 1",
            "email": "user1@gmail.com",
            "role": "owner",
            "last_sign_in_at": "2024-01-19T08:30:04.915Z",
            "created_at": "2024-01-17T08:22:28.274Z",
            "authz": {
                "can_change_roles": [
                    "owner",
                    "admin",
                    "developer",
                    "viewer"
                ],
                "can_remove": true
            }
        },
        {
            "id": "f0ee4474-bcde-4d3f-979d-bbf36f2d66b7",
            "name": null,
            "email": "user2@gmail.com",
            "role": "developer",
            "last_sign_in_at": "2024-01-19T08:27:04.38Z",
            "created_at": "2024-01-19T06:55:16.522Z",
            "authz": {
                "can_change_roles": [
                    "owner",
                    "admin",
                    "developer",
                    "viewer"
                ],
                "can_remove": true
            }
        }
    ]
  }
  ```

  </details>

- Failed requests have the following response shape

  ```json
  {
    "error": "Error message"
  }
  ```

#### Status Codes & Troubleshooting

List of HTTP status codes for success and failures.

<details>
<summary>Status Codes - Click to expand</summary>

| **Status**                  | **Meaning**                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200 Ok`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>
