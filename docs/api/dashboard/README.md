# Dashbaord REST API Documentation <!-- omit in toc -->

Find all the endpoints, resources and detailed documentation for Measure Dashboard REST APIs.

## Apps

- [**GET `/apps/:id/journey`**](#get-appsidjourney) - Fetch an app's issue journey map for a time range &amp; version.
- [**GET `/apps/:id/metrics`**](#get-appsidmetrics) - Fetch an app's health metrics for a time range &amp; version.
- [**GET `/apps/:id/filters`**](#get-appsidfilters) - Fetch an app's filters.
- [**GET `/apps/:id/crashGroups`**](#get-appsidcrashgroups) - Fetch list of crash groups for an app
- [**GET `/apps/:id/anrGroups`**](#get-appsidanrgroups) - Fetch list of ANR groups for an app

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

Fetch an list of crash groups for an app.

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
  [
    {
      "id": "b7002bf6-b19a-4ab9-93b8-2ebfb247f48c",
      "app_id": "2feef18c-ef08-4b51-90e5-d0f262068674",
      "app_version": "1.0",
      "name": "java.lang.IllegalAccessException",
      "fingerprint": "df6eb86ec361a76d",
      "count": 1,
      "events": [
        "d06aad71-f24c-47fb-bdb7-da60830f580c"
      ],
      "percentage_contribution": 12.5,
      "created_at": "2024-01-18T08:00:32.934Z",
      "updated_at": "2024-01-18T08:00:32.934Z"
    },
    {
      "id": "da3fbd01-5988-4385-8156-60f441ef5c75",
      "app_id": "2feef18c-ef08-4b51-90e5-d0f262068674",
      "app_version": "1.0",
      "name": "java.lang.StackOverflowError",
      "fingerprint": "db62b90cce53a7ed",
      "count": 3,
      "events": [
        "696b185f-e03d-494d-8322-2e26c79b233a",
        "87946c9d-1151-4a43-942e-2c89f092c47d",
        "a4e42b1e-faf9-45f5-ad85-8308e6ba4cef"
      ],
      "percentage_contribution": 37.5,
      "created_at": "2024-01-18T08:00:22.497Z",
      "updated_at": "2024-01-18T08:00:49.024Z"
    },
    {
      "id": "a8a1d9fe-28cb-41c2-902f-b01bdfa50f34",
      "app_id": "2feef18c-ef08-4b51-90e5-d0f262068674",
      "app_version": "1.0",
      "name": "java.lang.IllegalAccessException",
      "fingerprint": "df66b96cc371a76d",
      "count": 1,
      "events": [
        "45bd3e6e-ebb9-4d5b-8755-6b8d76e55062"
      ],
      "percentage_contribution": 12.5,
      "created_at": "2024-01-18T08:00:52.582Z",
      "updated_at": "2024-01-18T08:00:52.582Z"
    },
    {
      "id": "87d72676-cacf-4b28-8eef-c882d85f7fa5",
      "app_id": "2feef18c-ef08-4b51-90e5-d0f262068674",
      "app_version": "1.0",
      "name": "sh.measure.sample.CustomException",
      "fingerprint": "df62b96ec761a76d",
      "count": 1,
      "events": [
        "11ae01d3-8de8-44fc-b6bf-9fbf5632e565"
      ],
      "percentage_contribution": 12.5,
      "created_at": "2024-01-18T08:01:00.777Z",
      "updated_at": "2024-01-18T08:01:00.777Z"
    },
    {
      "id": "9ed752a3-02d0-49ac-af3c-5390dbcf2701",
      "app_id": "2feef18c-ef08-4b51-90e5-d0f262068674",
      "app_version": "1.0",
      "name": "t4.a",
      "fingerprint": "db62b90cc671a76d",
      "count": 1,
      "events": [
        "981e610a-ee73-4ad5-8ff3-3909b52dbbd9"
      ],
      "percentage_contribution": 12.5,
      "created_at": "2024-01-18T08:01:04.993Z",
      "updated_at": "2024-01-18T08:01:04.993Z"
    },
    {
      "id": "db4a02ce-3216-410a-9907-777e5d59ef2f",
      "app_id": "2feef18c-ef08-4b51-90e5-d0f262068674",
      "app_version": "1.0",
      "name": "java.lang.StackOverflowError",
      "fingerprint": "df62b92ccb33a76d",
      "count": 1,
      "events": [
        "8c67e57a-0666-4633-b536-b59c9fb70311"
      ],
      "percentage_contribution": 12.5,
      "created_at": "2024-01-18T08:01:15.729Z",
      "updated_at": "2024-01-18T08:01:15.729Z"
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

### GET `/apps/:id/anrGroups`

Fetch an list of ANR groups for an app.

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
  [
    {
      "id": "b7002bf6-b19a-4ab9-93b8-2ebfb247f48c",
      "app_id": "2feef18c-ef08-4b51-90e5-d0f262068674",
      "app_version": "1.0",
      "name": "Unsafe.java",
      "fingerprint": "df6eb86ec361a76d",
      "count": 1,
      "events": [
        "d06aad71-f24c-47fb-bdb7-da60830f580c"
      ],
      "percentage_contribution": 12.5,
      "created_at": "2024-01-18T08:00:32.934Z",
      "updated_at": "2024-01-18T08:00:32.934Z"
    },
    {
      "id": "da3fbd01-5988-4385-8156-60f441ef5c75",
      "app_id": "2feef18c-ef08-4b51-90e5-d0f262068674",
      "app_version": "1.0",
      "name": "Utils.java",
      "fingerprint": "db62b90cce53a7ed",
      "count": 3,
      "events": [
        "696b185f-e03d-494d-8322-2e26c79b233a",
        "87946c9d-1151-4a43-942e-2c89f092c47d",
        "a4e42b1e-faf9-45f5-ad85-8308e6ba4cef"
      ],
      "percentage_contribution": 37.5,
      "created_at": "2024-01-18T08:00:22.497Z",
      "updated_at": "2024-01-18T08:00:49.024Z"
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
