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

## Apps

- [**GET `/apps/:id/journey`**](#get-appsidjourney) - Fetch an app's issue journey map for a time range &amp; version.
- [**GET `/apps/:id/metrics`**](#get-appsidmetrics) - Fetch an app's health metrics for a time range &amp; version.

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

- For app's issue journey map

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
    "error": "Invalid time range"
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

- For app's health metrics

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
    "error": "Invalid time range"
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
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>