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
  - [GET `/apps/:id/crashGroups/plots/instances`](#get-appsidcrashgroupsplotsinstances)
    - [Usage Notes](#usage-notes-4)
    - [Authorization \& Content Type](#authorization--content-type-4)
    - [Response Body](#response-body-4)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-4)
  - [GET `/apps/:id/crashGroups/:id/crashes`](#get-appsidcrashgroupsidcrashes)
    - [Usage Notes](#usage-notes-5)
    - [Authorization \& Content Type](#authorization--content-type-5)
    - [Response Body](#response-body-5)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-5)
  - [GET `/apps/:id/crashGroups/:id/plots/instances`](#get-appsidcrashgroupsidplotsinstances)
    - [Usage Notes](#usage-notes-6)
    - [Authorization \& Content Type](#authorization--content-type-6)
    - [Response Body](#response-body-6)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-6)
  - [GET `/apps/:id/crashGroups/:id/plots/journey`](#get-appsidcrashgroupsidplotsjourney)
    - [Usage Notes](#usage-notes-7)
    - [Authorization \& Content Type](#authorization--content-type-7)
    - [Response Body](#response-body-7)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-7)
  - [GET `/apps/:id/anrGroups`](#get-appsidanrgroups)
    - [Usage Notes](#usage-notes-8)
    - [Authorization \& Content Type](#authorization--content-type-8)
    - [Response Body](#response-body-8)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-8)
  - [GET `/apps/:id/anrGroups/plots/instances`](#get-appsidanrgroupsplotsinstances)
    - [Usage Notes](#usage-notes-9)
    - [Authorization \& Content Type](#authorization--content-type-9)
    - [Response Body](#response-body-9)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-9)
  - [GET `/apps/:id/anrGroups/:id/anrs`](#get-appsidanrgroupsidanrs)
    - [Usage Notes](#usage-notes-10)
    - [Authorization \& Content Type](#authorization--content-type-10)
    - [Response Body](#response-body-10)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-10)
  - [GET `/apps/:id/anrGroups/:id/plots/instances`](#get-appsidanrgroupsidplotsinstances)
    - [Usage Notes](#usage-notes-11)
    - [Authorization \& Content Type](#authorization--content-type-11)
    - [Response Body](#response-body-11)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-11)
  - [GET `/apps/:id/anrGroups/:id/plots/journey`](#get-appsidanrgroupsidplotsjourney)
    - [Usage Notes](#usage-notes-12)
    - [Authorization \& Content Type](#authorization--content-type-12)
    - [Response Body](#response-body-12)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-12)
  - [GET `/apps/:id/sessions/:id`](#get-appsidsessionsid)
    - [Usage Notes](#usage-notes-13)
    - [Authorization \& Content Type](#authorization--content-type-13)
    - [Response Body](#response-body-13)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-13)
  - [GET `/apps/:id/alertPrefs`](#get-appsidalertprefs)
    - [Usage Notes](#usage-notes-14)
    - [Authorization \& Content Type](#authorization--content-type-14)
    - [Response Body](#response-body-14)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-14)
  - [PATCH `/apps/:id/alertPrefs`](#patch-appsidalertprefs)
    - [Usage Notes](#usage-notes-15)
    - [Request body](#request-body)
    - [Authorization \& Content Type](#authorization--content-type-15)
    - [Response Body](#response-body-15)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-15)
- [Teams](#teams)
  - [POST `/teams`](#post-teams)
    - [Authorization \& Content Type](#authorization--content-type-16)
    - [Request Body](#request-body-1)
    - [Usage Notes](#usage-notes-16)
    - [Response Body](#response-body-16)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-16)
  - [GET `/teams`](#get-teams)
    - [Authorization \& Content Type](#authorization--content-type-17)
    - [Response Body](#response-body-17)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-17)
  - [GET `/teams/:id/apps`](#get-teamsidapps)
    - [Usage Notes](#usage-notes-17)
    - [Authorization \& Content Type](#authorization--content-type-18)
    - [Response Body](#response-body-18)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-18)
  - [GET `/teams/:id/apps/:id`](#get-teamsidappsid)
    - [Usage Notes](#usage-notes-18)
    - [Authorization \& Content Type](#authorization--content-type-19)
    - [Response Body](#response-body-19)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-19)
  - [POST `/teams/:id/apps`](#post-teamsidapps)
    - [Usage Notes](#usage-notes-19)
    - [Request body](#request-body-2)
    - [Authorization \& Content Type](#authorization--content-type-20)
    - [Response Body](#response-body-20)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-20)
  - [POST `/auth/invite`](#post-authinvite)
    - [Usage Notes](#usage-notes-20)
    - [Request body](#request-body-3)
    - [Authorization \& Content Type](#authorization--content-type-21)
    - [Response Body](#response-body-21)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-21)
  - [PATCH `/teams/:id/rename`](#patch-teamsidrename)
    - [Usage Notes](#usage-notes-21)
    - [Request body](#request-body-4)
    - [Authorization \& Content Type](#authorization--content-type-22)
    - [Response Body](#response-body-22)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-22)
  - [GET `/teams/:id/members`](#get-teamsidmembers)
    - [Usage Notes](#usage-notes-22)
    - [Authorization \& Content Type](#authorization--content-type-23)
    - [Response Body](#response-body-23)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-23)
  - [DELETE `/teams/:id/members/:id`](#delete-teamsidmembersid)
    - [Usage Notes](#usage-notes-23)
    - [Authorization \& Content Type](#authorization--content-type-24)
    - [Response Body](#response-body-24)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-24)
  - [PATCH `/teams/:id/members/:id/role`](#patch-teamsidmembersidrole)
    - [Usage Notes](#usage-notes-24)
    - [Request body](#request-body-5)
    - [Authorization \& Content Type](#authorization--content-type-25)
    - [Response Body](#response-body-25)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-25)
  - [GET `/teams/:id/authz`](#get-teamsidauthz)
    - [Usage Notes](#usage-notes-25)
    - [Authorization \& Content Type](#authorization--content-type-26)
    - [Response Body](#response-body-26)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-26)

## Apps

- [**GET `/apps/:id/journey`**](#get-appsidjourney) - Fetch an app's issue journey map for a time range &amp; version.
- [**GET `/apps/:id/metrics`**](#get-appsidmetrics) - Fetch an app's health metrics for a time range &amp; version.
- [**GET `/apps/:id/filters`**](#get-appsidfilters) - Fetch an app's filters.
- [**GET `/apps/:id/crashGroups`**](#get-appsidcrashgroups) - Fetch an app's crash overview.
- [**GET `/apps/:id/crashGroups/plots/instances`**](#get-appsidcrashgroupsplotsinstances) - Fetch an app's crash overview instances plot aggregated by date range & version.
- [**GET `/apps/:id/crashGroups/:id/crashes`**](#get-appsidcrashgroupsidcrashes) - Fetch an app's crash detail.
- [**GET `/apps/:id/crashGroups/:id/plots/instances`**](#get-appsidcrashgroupsidplotsinstances) - Fetch an app's crash detail instances aggregrated by date range & version.
- [**GET `/apps/:id/crashGroups/:id/plots/journey`**](#get-appsidcrashgroupsidplotsjourney) - Fetch an app's crash journey map.
- [**GET `/apps/:id/anrGroups`**](#get-appsidanrgroups) - Fetch an app's ANR overview.
- [**GET `/apps/:id/anrGroups/plots/instances`**](#get-appsidanrgroupsplotsinstances) - Fetch an app's ANR overview instances plot aggregated by date range & version.
- [**GET `/apps/:id/anrGroups/:id/anrs`**](#get-appsidanrgroupsidanrs) - Fetch an app's ANR detail.
- [**GET `/apps/:id/anrGroups/:id/plots/instances`**](#get-appsidanrgroupsidplotsinstances) - Fetch an app's ANR detail instances aggregated by date range & version.
- [**GET `/apps/:id/anrGroups/:id/plots/journey`**](#get-appsidanrgroupsidplotsjourney) - Fetch an app's ANR journey map.
- [**GET `/apps/:id/sessions/:id`**](#get-appsidsessionsid) - Fetch an app's session replay.
- [**GET `/apps/:id/alertPrefs`**](#get-appsidalertprefs) - Fetch an app's alert preferences.
- [**PATCH `/apps/:id/alertPrefs`**](#patch-appsidalertprefs) - Update an app's alert preferences.

### GET `/apps/:id/journey`

Fetch an app's issue journey map. Filter time range using `from` &amp; `to` query string parameters. Filter versions using `versions` & `version_codes` query string parameter.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` - ISO8601 timestamp to include crashes after this time.
  - `to` - ISO8601 timestamp to include crashes before this time.
  - `versions` - List of comma separated version identifier strings to return only matching crashes.
  - `version_codes` - List of comma separated version codes to return only matching crashes.
  - `bigraph` (_optional_) - Choose journey's directionality. `0` computes a unidirectional graph. Default is `1`.

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
    "links": [
      {
        "source": "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
        "target": "au.com.shiftyjelly.pocketcasts.player.view.PlayerContainerFragment",
        "value": 4
      },
      {
        "source": "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
        "target": "au.com.shiftyjelly.pocketcasts.player.view.UpNextFragment",
        "value": 4
      },
      {
        "source": "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
        "target": "au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment",
        "value": 4
      },
      {
        "source": "au.com.shiftyjelly.pocketcasts.account.onboarding.OnboardingActivity",
        "target": "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
        "value": 1
      }
    ],
    "nodes": [
      {
        "id": "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
        "issues": {
          "anrs": [],
          "crashes": []
        }
      },
      {
        "id": "au.com.shiftyjelly.pocketcasts.player.view.PlayerContainerFragment",
        "issues": {
          "anrs": [],
          "crashes": []
        }
      },
      {
        "id": "au.com.shiftyjelly.pocketcasts.player.view.UpNextFragment",
        "issues": {
          "anrs": [],
          "crashes": []
        }
      },
      {
        "id": "au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment",
        "issues": {
          "anrs": [],
          "crashes": [
            {
              "id": "018f5c68-6fe0-75c9-81ba-b36871c8b5fa",
              "title": "java.lang.IllegalStateException",
              "count": 18
            },
            {
              "id": "018f5c68-b814-739d-bf8f-b8235da0e458",
              "title": "java.lang.IllegalStateException",
              "count": 6
            },
            {
              "id": "018f5c68-cab2-76f4-9404-3d3eb0de83f0",
              "title": "java.lang.IllegalStateException",
              "count": 4
            },
            {
              "id": "018f5c68-d389-732f-882b-8be086c82093",
              "title": "java.lang.IllegalStateException",
              "count": 2
            }
          ]
        }
      },
      {
        "id": "au.com.shiftyjelly.pocketcasts.account.onboarding.OnboardingActivity",
        "issues": {
          "anrs": [],
          "crashes": []
        }
      }
    ],
    "totalIssues": 30
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

Fetch an app's health metrics. Filter time range using `from` &amp; `to` query string parameters. Filter version using `versions` & `version_codes` query string parameter.

#### Usage Notes

- App's UUID must be passed in the URI.
- All filters must be passed as query strings.
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Number of items in `version` &amp; `version_codes` must be same.
- `from` &amp; `to` values must be ISO 8601 UTC strings in milliseconds precision. Example: `?from=2023-11-01T18:30:00.000Z&to=2023-11-08T18:30:00.000Z`
- `from` &amp; `to` will default to a last 7 days time range if not supplied.
- `versions` can accept multiple version identifiers separated with comma. Only the first version will be used to query at the moment.
- `version_codes` can accept multiple version identifiers separated with comma. Only the first version will be used to query at the moment.

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

- `nan` can be true if some computed values result in a division by zero error.

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "adoption": {
      "all_versions": 53,
      "selected_version": 23,
      "adoption": 43.4,
      "nan": false
    },
    "anr_free_sessions": {
      "anr_free_sessions": 100,
      "delta": 1,
      "nan": false
    },
    "cold_launch": {
      "delta": 0,
      "nan": true,
      "p95": 0
    },
    "crash_free_sessions": {
      "crash_free_sessions": 0,
      "delta": 1,
      "nan": false
    },
    "hot_launch": {
      "delta": 0,
      "nan": true,
      "p95": 0
    },
    "perceived_anr_free_sessions": {
      "perceived_anr_free_sessions": 100,
      "delta": 1,
      "nan": false
    },
    "perceived_crash_free_sessions": {
      "perceived_crash_free_sessions": 0,
      "delta": 1,
      "nan": false
    },
    "sizes": {
      "average_app_size": 26298701,
      "selected_app_size": 25887094,
      "delta": -411607,
      "nan": false
    },
    "warm_launch": {
      "delta": 0,
      "nan": true,
      "p95": 0
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
- Pass `crash=1` as query string parameter to only return filters for unhandled exceptions
- Pass `anr=1` as query string parameter to only return filters for ANRs
- Pass `exception=1` as query string parameter to only return filters for handled & unhandled exceptions
- If no query string parameters are passed, the API computes filters from all events

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
      {
        "code": "9400",
        "name": "7.61"
      },
      {
        "code": "9300",
        "name": "7.60"
      },
      {
        "code": "9200",
        "name": "7.59"
      }
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

Fetch an app's crash overview.

#### Usage Notes

- App's UUID must be passed in the URI
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Accepted query parameters
  - `from` (_optional_) - Start time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `to` (_optional_) - End time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `versions` (_optional_) - List of comma separated version identifier strings to return crash groups that have events matching the version.
  - `version_codes` (_optional_) - List of comma separated version codes to return crash groups that have events matching the version code.
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
        "id": "01903291-1eb4-7b81-854b-fd9d3bbccb4b",
        "app_id": "fddf4d6d-1df1-45f8-8bc7-9730f2236cb0",
        "name": "java.lang.IllegalStateException@RxJava2CallAdapterFactory.java:118",
        "fingerprint": "c37a8c1cc1c037f9",
        "count": 41,
        "percentage_contribution": 77.35849,
        "created_at": "2024-06-19T22:14:49.77Z",
        "updated_at": "2024-06-19T22:15:25.636Z"
      },
      {
        "id": "01903291-6652-7ecf-9a6d-53ef16b6203a",
        "app_id": "fddf4d6d-1df1-45f8-8bc7-9730f2236cb0",
        "name": "java.lang.IllegalStateException@RxJava2CallAdapterFactory.java:118",
        "fingerprint": "c3ea8c1cc1d033f9",
        "count": 6,
        "percentage_contribution": 11.320755,
        "created_at": "2024-06-19T22:15:08.109Z",
        "updated_at": "2024-06-19T22:15:23.134Z"
      },
      {
        "id": "01903291-7992-7c4f-b98e-6f8e93417695",
        "app_id": "fddf4d6d-1df1-45f8-8bc7-9730f2236cb0",
        "name": "java.lang.IllegalStateException@RxJava2CallAdapterFactory.java:118",
        "fingerprint": "c3faac1cc1c037bb",
        "count": 4,
        "percentage_contribution": 7.5471697,
        "created_at": "2024-06-19T22:15:13.038Z",
        "updated_at": "2024-06-19T22:15:21.224Z"
      },
      {
        "id": "01903291-8379-79ee-8a27-678368a0a5b8",
        "app_id": "fddf4d6d-1df1-45f8-8bc7-9730f2236cb0",
        "name": "java.lang.IllegalStateException@RxJava2CallAdapterFactory.java:118",
        "fingerprint": "c37acc1cc0c037bb",
        "count": 2,
        "percentage_contribution": 3.7735848,
        "created_at": "2024-06-19T22:15:15.573Z",
        "updated_at": "2024-06-19T22:15:19.957Z"
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

### GET `/apps/:id/crashGroups/plots/instances`

Fetch an app's crash overview instances plot aggregated by date range & version.

#### Usage Notes

- App's UUID must be passed in the URI
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Accepted query parameters
  - `from` (_optional_) - Start time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `to` (_optional_) - End time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `versions` (_optional_) - List of comma separated version identifier strings to return crash groups that have events matching the version.
  - `version_codes` (_optional_) - List of comma separated version codes to return crash groups that have events matching the version code.
- Both `from` and `to` **MUST** be present when specifyng date range.

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
      "id": "7.61 (9400)",
      "data": [
        {
          "crash_free_sessions": 0,
          "datetime": "2024-04-29",
          "instances": 23
        }
      ]
    },
    {
      "id": "7.62 (9223)",
      "data": [
        {
          "crash_free_sessions": 0,
          "datetime": "2024-04-29",
          "instances": 30
        }
      ]
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

### GET `/apps/:id/crashGroups/:id/crashes`

Fetch an app's crash detail.

#### Usage Notes

- App's UUID must be passed in the URI
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Accepted query parameters
  - `from` (_optional_) - ISO8601 timestamp to include crashes after this time.
  - `to` (_optional_) - ISO8601 timestamp to include crashes before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching crashes.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching crashes.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching crashes.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching crashes.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching crashes.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching crashes.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching crashes.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching crashes.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching crashes.
  - `key_id` (_optional_) - UUID of the last item. Used for keyset based pagination. Should be used along with `key_timestamp` &amp; `limit`.
  - `key_timestamp` (_optional_) - ISO8601 timestamp of the last item. Used for keyset based pagination. Should be used along with `key_id` &amp; `limit`.
  - `limit` (_optional_) - Number of items to return. Used for keyset based pagination. Should be used along with `key_id` &amp; `key_timestamp`.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.

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
      "previous": false
    },
    "results": [
      {
        "id": "d0cae3d6-c42a-4d0c-a35b-df0b5d1435b2",
        "session_id": "f1681cff-4da9-4a33-bb1f-ed5d00b21b90",
        "timestamp": "2024-05-03T23:33:59.724Z",
        "type": "exception",
        "attribute": {
          "installation_id": "ee40eb0e-c579-473d-bc10-557049f51cda",
          "app_version": "1.0",
          "app_build": "1",
          "app_unique_id": "sh.measure.sample",
          "measure_sdk_version": "0.1.0",
          "platform": "android",
          "thread_name": "main",
          "user_id": "",
          "device_name": "emu64a",
          "device_model": "sdk_gphone64_arm64",
          "device_manufacturer": "Google",
          "device_type": "phone",
          "device_is_foldable": true,
          "device_is_physical": false,
          "device_density_dpi": 440,
          "device_width_px": 1080,
          "device_height_px": 2154,
          "device_density": 2.75,
          "device_locale": "en-US",
          "os_name": "android",
          "os_version": "33",
          "network_type": "wifi",
          "network_provider": "",
          "network_generation": "unknown"
        },
        "exception": {
          "title": "java.lang.OutOfMemoryError@ExceptionDemoActivity.kt:29",
          "stacktrace": "java.lang.OutOfMemoryError: Failed to allocate a 104857616 byte allocation with 25165824 free bytes and 87MB until OOM, target footprint 134540152, growth limit 201326592\n\tat sh.measure.sample.ExceptionDemoActivity.onCreate$lambda$2(ExceptionDemoActivity.kt:29)\n\tat sh.measure.sample.ExceptionDemoActivity.$r8$lambda$itIQQMXgA5GFCPpehqNC2ZDufqA\n\tat sh.measure.sample.ExceptionDemoActivity$$ExternalSyntheticLambda3.onClick(D8$$SyntheticClass)\n\tat android.view.View.performClick(View.java:7506)\n\tat com.google.android.material.button.MaterialButton.performClick(MaterialButton.java:1218)\n\tat android.view.View.performClickInternal(View.java:7483)\n\tat android.view.View.-$$Nest$mperformClickInternal\n\tat android.view.View$PerformClick.run(View.java:29334)\n\tat android.os.Handler.handleCallback(Handler.java:942)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)",
          "message": "Failed to allocate a 104857616 byte allocation with 25165824 free bytes and 87MB until OOM, target footprint 134540152, growth limit 201326592"
        },
        "attachments": [
          {
            "id": "ccd173ca-a9de-47ec-998f-0dd2f386ee12",
            "name": "screenshot.png",
            "type": "screenshot",
            "key": "ccd173ca-a9de-47ec-998f-0dd2f386ee12.png",
            "location": "http://localhost:9111/msr-attachments-sandbox/ccd173ca-a9de-47ec-998f-0dd2f386ee12.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minio%2F20240620%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240620T031359Z&X-Amz-Expires=172800&X-Amz-SignedHeaders=host&X-Amz-Signature=9d3e372b98eb55ded8ca88b50edc2975cd77f3b722c357f400cf6d6e9e2d8fbe"
          }
        ],
        "threads": [
          {
            "name": "Thread-2",
            "frames": [
              "java.lang.Thread.sleep(Thread.java:-2)",
              "java.lang.Thread.sleep(Thread.java:450)",
              "java.lang.Thread.sleep(Thread.java:355)",
              "sh.measure.android.anr.ANRWatchDog.run(ANRWatchDog.kt:70)"
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
            "name": "Okio Watchdog",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2211)",
              "okio.AsyncTimeout$Companion.awaitTimeout(AsyncTimeout.kt:370)",
              "okio.AsyncTimeout$Watchdog.run(AsyncTimeout.kt:211)"
            ]
          },
          {
            "name": "FinalizerDaemon",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)",
              "java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:203)",
              "java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:224)",
              "java.lang.Daemons$FinalizerDaemon.runInternal(Daemons.java:300)",
              "java.lang.Daemons$Daemon.run(Daemons.java:140)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "ReferenceQueueDaemon",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)",
              "java.lang.Object.wait(Object.java:568)",
              "java.lang.Daemons$ReferenceQueueDaemon.runInternal(Daemons.java:232)",
              "java.lang.Daemons$Daemon.run(Daemons.java:140)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "msr-ep",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1176)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "msr-bg",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1176)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "FinalizerWatchdogDaemon",
            "frames": [
              "java.lang.Thread.sleep(Thread.java:-2)",
              "java.lang.Thread.sleep(Thread.java:450)",
              "java.lang.Thread.sleep(Thread.java:355)",
              "java.lang.Daemons$FinalizerWatchdogDaemon.sleepForNanos(Daemons.java:438)",
              "java.lang.Daemons$FinalizerWatchdogDaemon.waitForProgress(Daemons.java:480)",
              "java.lang.Daemons$FinalizerWatchdogDaemon.runInternal(Daemons.java:369)",
              "java.lang.Daemons$Daemon.run(Daemons.java:140)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "msr-ee",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1176)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          }
        ]
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

### GET `/apps/:id/crashGroups/:id/plots/instances`

Fetch an app's crash detail instances aggregrated by date range & version.

#### Usage Notes

- App's UUID must be passed in the URI
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Accepted query parameters
  - `from` (_optional_) - ISO8601 timestamp to include crashes after this time.
  - `to` (_optional_) - ISO8601 timestamp to include crashes before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching crashes.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching crashes.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching crashes.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching crashes.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching crashes.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching crashes.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching crashes.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching crashes.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching crashes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.

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
      "id": "7.61 (9400)",
      "data": [
        {
          "datetime": "2024-04-29",
          "instances": 23
        }
      ]
    },
    {
      "id": "7.62 (9223)",
      "data": [
        {
          "datetime": "2024-04-29",
          "instances": 18
        }
      ]
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

### GET `/apps/:id/crashGroups/:id/plots/journey`

Fetch an app's crash journey map.

#### Usage Notes

- App's UUID must be passed in the URI
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Accepted query parameters
  - `from` - ISO8601 timestamp to include crashes after this time.
  - `to` - ISO8601 timestamp to include crashes before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching crashes.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching crashes.
  - `bigraph` - Choose journey's directionality. `0` computes a unidirectional graph. Default is `1`.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching crashes.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching crashes.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching crashes.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching crashes.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching crashes.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching crashes.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching crashes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.

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
    "links": [
      {
        "source": "sh.measure.sample.ExceptionDemoActivity",
        "target": "sh.measure.sample.OkHttpActivity",
        "value": 6
      },
      {
        "source": "sh.measure.sample.ExceptionDemoActivity",
        "target": "sh.measure.sample.ComposeActivity",
        "value": 5
      },
      {
        "source": "sh.measure.sample.ExceptionDemoActivity",
        "target": "sh.measure.sample.ComposeNavigationActivity",
        "value": 6
      }
    ],
    "nodes": [
      {
        "id": "sh.measure.sample.ExceptionDemoActivity",
        "issues": {
          "crashes": [
            {
              "id": "018fba31-0012-7274-8874-8b062b9f6690",
              "title": "java.lang.IllegalAccessException",
              "count": 7
            }
          ]
        }
      },
      {
        "id": "sh.measure.sample.OkHttpActivity",
        "issues": {
          "crashes": [
            {
              "id": "018fba31-0012-7274-8874-8b062b9f6690",
              "title": "java.lang.IllegalAccessException",
              "count": 1
            }
          ]
        }
      },
      {
        "id": "sh.measure.sample.ComposeActivity",
        "issues": {
          "crashes": []
        }
      },
      {
        "id": "sh.measure.sample.ComposeNavigationActivity",
        "issues": {
          "crashes": [
            {
              "id": "018fba31-0012-7274-8874-8b062b9f6690",
              "title": "java.lang.IllegalAccessException",
              "count": 9
            }
          ]
        }
      }
    ],
    "totalIssues": 17
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

### GET `/apps/:id/anrGroups`

Fetch an app's ANR overview.

#### Usage Notes

- App's UUID must be passed in the URI
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Accepted query parameters
  - `from` (_optional_) - Start time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `to` (_optional_) - End time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `versions` (_optional_) - List of comma separated version identifier strings to return anr groups that have events matching the version.
  - `version_codes` (_optional_) - List of comma separated version codes to return anr groups that have events matching the version code.
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
        "id": "01903291-c21a-7e2a-923d-90d3793a8fb0",
        "app_id": "2b7ddad4-40a6-42a7-9e21-a90577e08263",
        "name": "sh.measure.android.anr.AnrError@ExceptionDemoActivity.kt:62",
        "fingerprint": "c37ac85cc1d013f9",
        "count": 3,
        "percentage_contribution": 75,
        "created_at": "2024-06-19T22:15:31.608Z",
        "updated_at": "2024-06-19T22:15:34.659Z"
      },
      {
        "id": "01903291-cc74-793b-ba28-842ffecdb774",
        "app_id": "2b7ddad4-40a6-42a7-9e21-a90577e08263",
        "name": "sh.measure.android.anr.AnrError@ExceptionDemoActivity.kt:66",
        "fingerprint": "8368c85cc1c013f9",
        "count": 1,
        "percentage_contribution": 25,
        "created_at": "2024-06-19T22:15:34.258Z",
        "updated_at": "2024-06-19T22:15:34.258Z"
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

### GET `/apps/:id/anrGroups/plots/instances`

Fetch an app's ANR overview instances plot aggregated by date range & version.

#### Usage Notes

- App's UUID must be passed in the URI
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Accepted query parameters
  - `from` (_optional_) - Start time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `to` (_optional_) - End time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `versions` (_optional_) - List of comma separated version identifier strings to return crash groups that have events matching the version.
  - `version_codes` (_optional_) - List of comma separated version codes to return crash groups that have events matching the version code.
- Both `from` and `to` **MUST** be present when specifyng date range.

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
      "id": "7.61 (9400)",
      "data": [
        {
          "anr_free_sessions": 100,
          "datetime": "2024-04-29",
          "instances": 0
        }
      ]
    },
    {
      "id": "7.62 (9223)",
      "data": [
        {
          "anr_free_sessions": 100,
          "datetime": "2024-04-29",
          "instances": 0
        }
      ]
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

### GET `/apps/:id/anrGroups/:id/anrs`

Fetch an app's ANR detail.

#### Usage Notes

- App's UUID must be passed in the URI
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Accepted query parameters
  - `from` (_optional_) - ISO8601 timestamp to include anrs after this time.
  - `to` (_optional_) - ISO8601 timestamp to include anrs before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching anrs.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching anrs.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching anrs.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching anrs.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching anrs.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching anrs.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching anrs.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching anrs.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching anrs.
  - `key_id` (_optional_) - UUID of the last item. Used for keyset based pagination. Should be used along with `key_timestamp` &amp; `limit`.
  - `key_timestamp` (_optional_) - ISO8601 timestamp of the last item. Used for keyset based pagination. Should be used along with `key_id` &amp; `limit`.
  - `limit` (_optional_) - Number of items to return. Used for keyset based pagination. Should be used along with `key_id` &amp; `key_timestamp`.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.

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
      "previous": false
    },
    "results": [
      {
        "id": "e8f656b5-65c3-46ad-a03d-0ba777cff13f",
        "session_id": "58e94ae9-a084-479f-9049-2c5135f6090f",
        "timestamp": "2024-05-03T23:34:27.578Z",
        "type": "anr",
        "attribute": {
          "installation_id": "ee40eb0e-c579-473d-bc10-557049f51cda",
          "app_version": "1.0",
          "app_build": "1",
          "app_unique_id": "sh.measure.sample",
          "measure_sdk_version": "0.1.0",
          "platform": "android",
          "thread_name": "Thread-2",
          "user_id": "",
          "device_name": "emu64a",
          "device_model": "sdk_gphone64_arm64",
          "device_manufacturer": "Google",
          "device_type": "phone",
          "device_is_foldable": true,
          "device_is_physical": false,
          "device_density_dpi": 440,
          "device_width_px": 1080,
          "device_height_px": 2154,
          "device_density": 2.75,
          "device_locale": "en-US",
          "os_name": "android",
          "os_version": "33",
          "network_type": "wifi",
          "network_provider": "",
          "network_generation": "unknown"
        },
        "anr": {
          "title": "sh.measure.android.anr.AnrError@ExceptionDemoActivity.kt:66",
          "stacktrace": "sh.measure.android.anr.AnrError: Application Not Responding for at least 5000 ms.\n\tat sh.measure.sample.ExceptionDemoActivity.deadLock$lambda$10(ExceptionDemoActivity.kt:66)\n\tat sh.measure.sample.ExceptionDemoActivity.$r8$lambda$G4MY09CRhRk9ettfD7HPDD_b1n4\n\tat sh.measure.sample.ExceptionDemoActivity$$ExternalSyntheticLambda0.run(R8$$SyntheticClass)\n\tat android.os.Handler.handleCallback(Handler.java:942)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)",
          "message": "Application Not Responding for at least 5000 ms."
        },
        "attachments": [
          {
            "id": "63fb0950-faff-4028-bf3d-354559e4e540",
            "name": "screenshot.png",
            "type": "screenshot",
            "key": "63fb0950-faff-4028-bf3d-354559e4e540.png",
            "location": "http://localhost:9111/msr-attachments-sandbox/63fb0950-faff-4028-bf3d-354559e4e540.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minio%2F20240620%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240620T031655Z&X-Amz-Expires=172800&X-Amz-SignedHeaders=host&X-Amz-Signature=c174d870816ed98612760b4cd60252bfb9c7551f800a8fa0fc6e2acd3bffc98c"
          }
        ],
        "threads": [
          {
            "name": "OkHttp TaskRunner",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)",
              "java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp TaskRunner",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)",
              "java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "FinalizerWatchdogDaemon",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)",
              "java.lang.Object.wait(Object.java:568)",
              "java.lang.Daemons$FinalizerWatchdogDaemon.sleepUntilNeeded(Daemons.java:385)",
              "java.lang.Daemons$FinalizerWatchdogDaemon.runInternal(Daemons.java:365)",
              "java.lang.Daemons$Daemon.run(Daemons.java:140)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp Dispatcher",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)",
              "java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "Thread-2",
            "frames": [
              "dalvik.system.VMStack.getThreadStackTrace(VMStack.java:-2)",
              "java.lang.Thread.getStackTrace(Thread.java:1841)",
              "java.lang.Thread.getAllStackTraces(Thread.java:1909)",
              "sh.measure.android.exceptions.ExceptionFactory.createMeasureException(ExceptionFactory.kt:36)",
              "sh.measure.android.anr.AnrCollector.toMeasureException(AnrCollector.kt:41)",
              "sh.measure.android.anr.AnrCollector.onAppNotResponding(AnrCollector.kt:36)",
              "sh.measure.android.anr.ANRWatchDog.run(ANRWatchDog.kt:102)"
            ]
          },
          {
            "name": "OkHttp TaskRunner",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)",
              "java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "Okio Watchdog",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2211)",
              "okio.AsyncTimeout$Companion.awaitTimeout(AsyncTimeout.kt:370)",
              "okio.AsyncTimeout$Watchdog.run(AsyncTimeout.kt:211)"
            ]
          },
          {
            "name": "msr-ep",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1176)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp TaskRunner",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)",
              "java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
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
            "name": "OkHttp TaskRunner",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "okhttp3.internal.concurrent.TaskRunner$RealBackend.coordinatorWait(TaskRunner.kt:294)",
              "okhttp3.internal.concurrent.TaskRunner.awaitTaskToRun(TaskRunner.kt:218)",
              "okhttp3.internal.concurrent.TaskRunner$runnable$1.run(TaskRunner.kt:59)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1137)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          }
        ]
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

### GET `/apps/:id/anrGroups/:id/plots/instances`

Fetch an app's ANR detail instances aggregated by date range & version.

#### Usage Notes

- App's UUID must be passed in the URI
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Accepted query parameters
  - `from` (_optional_) - ISO8601 timestamp to include crashes after this time.
  - `to` (_optional_) - ISO8601 timestamp to include crashes before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching crashes.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching crashes.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching crashes.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching crashes.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching crashes.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching crashes.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching crashes.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching crashes.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching crashes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.

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
      "id": "1.0 (1)",
      "data": [
        {
          "datetime": "2024-05-03",
          "instances": 1
        }
      ]
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

### GET `/apps/:id/anrGroups/:id/plots/journey`

Fetch an app's ANR journey map.

#### Usage Notes

- App's UUID must be passed in the URI
- Both `version` &amp; `version_codes` should be present if any one of them is present.
- Accepted query parameters
  - `from` - ISO8601 timestamp to include crashes after this time.
  - `to` - ISO8601 timestamp to include crashes before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching crashes.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching crashes.
  - `bigraph` - Choose journey's directionality. `0` computes a unidirectional graph. Default is `1`.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching crashes.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching crashes.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching crashes.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching crashes.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching crashes.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching crashes.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching crashes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.

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
    "links": [
      {
        "source": "sh.measure.sample.ExceptionDemoActivity",
        "target": "sh.measure.sample.ComposeActivity",
        "value": 5
      },
      {
        "source": "sh.measure.sample.ExceptionDemoActivity",
        "target": "sh.measure.sample.ComposeNavigationActivity",
        "value": 6
      },
      {
        "source": "sh.measure.sample.ExceptionDemoActivity",
        "target": "sh.measure.sample.OkHttpActivity",
        "value": 6
      },
      {
        "source": "sh.measure.sample.OkHttpActivity",
        "target": "sh.measure.sample.ExceptionDemoActivity",
        "value": 5
      },
      {
        "source": "sh.measure.sample.ComposeActivity",
        "target": "sh.measure.sample.ExceptionDemoActivity",
        "value": 5
      },
      {
        "source": "sh.measure.sample.ComposeNavigationActivity",
        "target": "sh.measure.sample.ExceptionDemoActivity",
        "value": 6
      }
    ],
    "nodes": [
      {
        "id": "sh.measure.sample.ExceptionDemoActivity",
        "issues": {
          "anrs": [
            {
              "id": "018fba31-057c-70db-83c5-a7fa3c27f3f5",
              "title": "sh.measure.android.anr.AnrError",
              "count": 1
            }
          ]
        }
      },
      {
        "id": "sh.measure.sample.OkHttpActivity",
        "issues": {
          "anrs": []
        }
      },
      {
        "id": "sh.measure.sample.ComposeActivity",
        "issues": {
          "anrs": []
        }
      },
      {
        "id": "sh.measure.sample.ComposeNavigationActivity",
        "issues": {
          "anrs": [
            {
              "id": "018fba31-057c-70db-83c5-a7fa3c27f3f5",
              "title": "sh.measure.android.anr.AnrError",
              "count": 1
            }
          ]
        }
      }
    ],
    "totalIssues": 2
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

### GET `/apps/:id/sessions/:id`

Fetch an app's session replay.

#### Usage Notes

- App's UUID must be passed in the URI
- Sessions's UUID must be passed in the URI

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
    "app_id": "2b7ddad4-40a6-42a7-9e21-a90577e08263",
    "attribute": {
      "installation_id": "ee40eb0e-c579-473d-bc10-557049f51cda",
      "app_version": "1.0",
      "app_build": "1",
      "app_unique_id": "sh.measure.sample",
      "measure_sdk_version": "0.1.0",
      "platform": "android",
      "thread_name": "msr-cmu",
      "user_id": "",
      "device_name": "emu64a",
      "device_model": "sdk_gphone64_arm64",
      "device_manufacturer": "Google",
      "device_type": "phone",
      "device_is_foldable": true,
      "device_is_physical": false,
      "device_density_dpi": 440,
      "device_width_px": 1080,
      "device_height_px": 2154,
      "device_density": 2.75,
      "device_locale": "en-US",
      "os_name": "android",
      "os_version": "33",
      "network_type": "wifi",
      "network_provider": "",
      "network_generation": ""
    },
    "cpu_usage": [
      {
        "timestamp": "2024-05-03T23:35:24.911Z",
        "value": 7.666666666666668
      }
    ],
    "duration": 13492,
    "memory_usage": null,
    "session_id": "630a954e-a86f-4349-aab8-9e3d068fc5f9",
    "threads": {
      "main": [
        {
          "event_type": "lifecycle_activity",
          "thread_name": "main",
          "type": "created",
          "class_name": "sh.measure.sample.ExceptionDemoActivity",
          "intent": "",
          "saved_instance_state": false,
          "timestamp": "2024-05-03T23:35:24.998Z"
        },
        {
          "event_type": "lifecycle_app",
          "thread_name": "main",
          "type": "foreground",
          "timestamp": "2024-05-03T23:35:25.112Z"
        },
        {
          "event_type": "exception",
          "title": "java.lang.IllegalAccessException: This is a new exception",
          "thread_name": "main",
          "handled": false,
          "stacktrace": "java.lang.IllegalAccessException: This is a new exception\n\tat sh.measure.sample.ExceptionDemoActivity.onCreate$lambda$0(ExceptionDemoActivity.kt:19)\n\tat sh.measure.sample.ExceptionDemoActivity.$r8$lambda$Q_ui1nZ8w7tXFl-UGrB13ccXmnU\n\tat sh.measure.sample.ExceptionDemoActivity$$ExternalSyntheticLambda1.onClick(R8$$SyntheticClass)\n\tat android.view.View.performClick(View.java:7506)\n\tat com.google.android.material.button.MaterialButton.performClick(MaterialButton.java:1218)\n\tat android.view.View.performClickInternal(View.java:7483)\n\tat android.view.View.-$$Nest$mperformClickInternal\n\tat android.view.View$PerformClick.run(View.java:29334)\n\tat android.os.Handler.handleCallback(Handler.java:942)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalAccessException: This is a new exception\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.reflect.InvocationTargetException\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:558)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)",
          "foreground": true,
          "timestamp": "2024-05-03T23:35:38.403Z",
          "attachments": [
            {
              "id": "797f8309-6185-4f4c-8578-0336c27d91f9",
              "name": "screenshot.png",
              "type": "screenshot",
              "key": "797f8309-6185-4f4c-8578-0336c27d91f9.png",
              "location": "http://localhost:9111/msr-attachments-sandbox/797f8309-6185-4f4c-8578-0336c27d91f9.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minio%2F20240611%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240611T200801Z&X-Amz-Expires=172800&X-Amz-SignedHeaders=host&X-Amz-Signature=56ab78ccf1162ef45beddd89fe5b069b94e1f9d51f77e01fed73ade4bc2033c9"
            }
          ]
        }
      ]
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

### GET `/apps/:id/alertPrefs`

Fetch an app's alert preferences.

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
      "crash_rate_spike": {
        "email": true,
        "slack": false
      },
      "anr_rate_spike": {
        "email": true,
        "slack": false
      },
      "launch_time_spike": {
        "email": true,
        "slack": false
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

### PATCH `/apps/:id/alertPrefs`

Update an app's alert preferences.

#### Usage Notes

- App's UUID must be passed in the URI

#### Request body

  ```json
  {
      "crash_rate_spike": {
        "email": true,
        "slack": false
      },
      "anr_rate_spike": {
        "email": true,
        "slack": false
      },
      "launch_time_spike": {
        "email": true,
        "slack": false
      }
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

## Teams

- [**POST `/teams`**](#post-teams) - Create new team. Access token holder becomes the owner.
- [**GET `/teams`**](#get-teams) - Fetch list of teams of access token holder.
- [**GET `/teams/:id/apps`**](#get-teamsidapps) - Fetch list of apps for a team.
- [**GET `/teams/:id/apps/:id`**](#get-teamsidappsid) - Fetch details of an app for a team.
- [**POST `/teams/:id/apps`**](#post-teamsidapps) - Create a new app for a team.
- [**POST `/teams/:id/invite`**](#post-teamsidinvite) - Invite new members (both existing & non measure users) to a team.
- [**PATCH `/teams/:id/rename`**](#patch-teamsidrename) -  Rename a team.
- [**GET `/teams/:id/members`**](#get-teamsidmembers) -  Fetch list of team members for a team.
- [**DELETE `/teams/:id/members/:id`**](#delete-teamsidmembersid) -  Remove a member from a team.
- [**PATCH `/teams/:id/members/:id/role`**](#patch-teamsidmembersid) -  Change role of a member of a team.
- [**GET `/teams/:id/authz`**](#get-teamsidauthz) -  Fetch authorization details of access token holder for a team.

### POST `/teams`

Create a new team. Only owners of existing team can create new teams.

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

#### Request Body

Pass the name in `"name"` JSON property.

```json
{
  "name": "acme-team"
}
```

#### Usage Notes

- `"name"` cannot be empty

#### Response Body

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "id": "269362f4-27a5-4eac-84f8-b2291515edd3",
    "name": "acme-team"
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
| `201 Created`                    | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/teams`

Fetch list of teams of access token holder.

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

### PATCH `/teams/:id/members/:id/role`

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

Fetch authorization details of access token holder for a team.

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
