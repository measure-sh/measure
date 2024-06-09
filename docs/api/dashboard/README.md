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

- App's UUID must be passed in the URI
- All filters must be passed as query strings
- All filters are optional. If any filter is not present, the server will compute results assuming a default value for that filter.
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

- Response

  <details><summary>Click to expand</summary>

  ```json
  {
    "adoption": {
      "all_versions": 33,
      "selected_version": 7,
      "adoption": 21.21,
      "nan": false
    },
    "anr_free_sessions": {
      "anr_free_sessions": 100,
      "delta": -78.79,
      "nan": false
    },
    "cold_launch": {
      "delta": 34.8,
      "nan": false,
      "p95": 2771.8
    },
    "crash_free_sessions": {
      "crash_free_sessions": 71.43,
      "delta": -78.79,
      "nan": false
    },
    "hot_launch": {
      "delta": 0,
      "nan": false,
      "p95": 475.9
    },
    "perceived_anr_free_sessions": {
      "perceived_anr_free_sessions": 100,
      "delta": -78.79,
      "nan": false
    },
    "perceived_crash_free_sessions": {
      "perceived_crash_free_sessions": 71.43,
      "delta": -78.79,
      "nan": false
    },
    "sizes": {
      "average_app_size": 32359196.33,
      "selected_app_size": 45196797,
      "delta": 12837600.67,
      "nan": false
    },
    "warm_launch": {
      "delta": -129.9,
      "nan": false,
      "p95": 554.6
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

### GET `/apps/:id/crashGroups/plots/instances`

Fetch an app's crash overview instances plot aggregated by date range & version.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` (_optional_) - Start time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `to` (_optional_) - End time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `versions` (_optional_) - List of comma separated version identifier strings to return crash groups that have events matching the version.
  - `version_codes` (_optional_) - List of comma separated version codes to return crash groups that have events matching the version code.
- Both `from` and `to` **MUST** be present when specifyng date range.
- Both `version` and `version_codes` **MUST** be present when specifying versions.

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
      "next": true,
      "previous": false
    },
    "results": [
      {
        "id": "db08c0ae-bc5e-49cb-9047-71a39b80f535",
        "session_id": "1d8b13f3-e226-4ac8-bf5f-cdf2e1443b4c",
        "timestamp": "2024-04-29T12:08:36.962Z",
        "type": "exception",
        "attribute": {
          "installation_id": "b0ba2ee2-aae9-4cb1-b08b-82c1aadee68c",
          "app_version": "7.62",
          "app_build": "9223",
          "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
          "network_generation": ""
        },
        "exception": {
          "title": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>",
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
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
            "name": "Measurement Worker",
            "frames": [
              "android.os.MessageQueue.nativeWake(MessageQueue.java:-2)",
              "android.os.MessageQueue.enqueueMessage(MessageQueue.java:598)",
              "android.os.Handler.enqueueMessage(Handler.java:778)",
              "android.os.Handler.sendMessageAtTime(Handler.java:727)",
              "android.os.Handler.sendMessageDelayed(Handler.java:697)",
              "android.os.Handler.sendEmptyMessageDelayed(Handler.java:662)",
              "android.app.QueuedWork.queue(QueuedWork.java:229)",
              "android.app.SharedPreferencesImpl.enqueueDiskWrite(SharedPreferencesImpl.java:696)",
              "android.app.SharedPreferencesImpl.-$$Nest$menqueueDiskWrite",
              "android.app.SharedPreferencesImpl$EditorImpl.apply(SharedPreferencesImpl.java:505)",
              "java.util.concurrent.Executors$RunnableAdapter.call(Executors.java:463)",
              "java.util.concurrent.FutureTask.run(FutureTask.java:264)"
            ]
          },
          {
            "name": "OkHttp ConnectionPool",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "com.android.okhttp.ConnectionPool$1.run(ConnectionPool.java:106)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1137)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
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
            "name": "pool-21-thread-1",
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
            "name": "RxCachedThreadScheduler-3",
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
            "name": "pool-5-thread-1",
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
            "name": "RxSchedulerPurge-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "pool-6-thread-1",
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
            "name": "RxComputationThreadPool-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "DefaultDispatcher-worker-3",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:357)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.park(CoroutineScheduler.kt:856)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.tryPark(CoroutineScheduler.kt:801)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:749)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:702)"
            ]
          },
          {
            "name": "WM.task-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
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
            "name": "pool-2-thread-1",
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
          }
        ]
      },
      {
        "id": "aa782688-76e9-446b-b6b3-11feae59a5d1",
        "session_id": "df022f65-9ed0-40f3-92d2-6d9a234350e1",
        "timestamp": "2024-04-29T12:08:34.616Z",
        "type": "exception",
        "attribute": {
          "installation_id": "b0ba2ee2-aae9-4cb1-b08b-82c1aadee68c",
          "app_version": "7.62",
          "app_build": "9223",
          "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
          "network_generation": ""
        },
        "exception": {
          "title": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>",
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
          {
            "name": "heartbeat-information-executor",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxCachedWorkerPoolEvictor-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "arch_disk_io_1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
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
          },
          {
            "name": "kotlinx.coroutines.DefaultExecutor",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "kotlinx.coroutines.DefaultExecutor.run(DefaultExecutor.kt:118)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
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
            "name": "RxCachedThreadScheduler-3",
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
            "name": "ScionFrontendApi",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "arch_disk_io_0",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxCachedThreadScheduler-4",
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
            "name": "pool-2-thread-1",
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
            "name": "RxSchedulerPurge-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "WM.task-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          }
        ]
      },
      {
        "id": "a9b9d960-e57b-4fbf-89d7-965d84d80a04",
        "session_id": "ec601398-93ef-4007-869a-66f217c492ed",
        "timestamp": "2024-04-29T12:08:30.008Z",
        "type": "exception",
        "attribute": {
          "installation_id": "b0ba2ee2-aae9-4cb1-b08b-82c1aadee68c",
          "app_version": "7.62",
          "app_build": "9223",
          "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
          "network_generation": ""
        },
        "exception": {
          "title": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>",
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
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
          },
          {
            "name": "RxCachedThreadScheduler-1",
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
            "name": "heartbeat-information-executor",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxCachedThreadScheduler-4",
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
            "name": "pool-6-thread-1",
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
            "name": "Thread-8",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)",
              "java.lang.Object.wait(Object.java:568)",
              "com.automattic.android.tracks.TracksClient$3.run(TracksClient.java:224)",
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
            "name": "AsyncTask #1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:461)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)",
              "java.util.concurrent.SynchronousQueue.take(SynchronousQueue.java:922)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "Measurement Worker",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)"
            ]
          },
          {
            "name": "pool-2-thread-1",
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
            "name": "RxCachedThreadScheduler-2",
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
            "name": "pool-16-thread-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp ConnectionPool",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "com.android.okhttp.ConnectionPool$1.run(ConnectionPool.java:106)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1137)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          }
        ]
      },
      {
        "id": "c2832a21-ffe2-459e-9234-3ec7a1cc5feb",
        "session_id": "fd54fac2-4be7-4cb4-a953-7e9c38fbc629",
        "timestamp": "2024-04-29T12:08:27.729Z",
        "type": "exception",
        "attribute": {
          "installation_id": "b0ba2ee2-aae9-4cb1-b08b-82c1aadee68c",
          "app_version": "7.62",
          "app_build": "9223",
          "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
          "network_generation": ""
        },
        "exception": {
          "title": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>",
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
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
            "name": "DefaultDispatcher-worker-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:357)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.park(CoroutineScheduler.kt:856)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.tryPark(CoroutineScheduler.kt:801)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:749)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:702)"
            ]
          },
          {
            "name": "pool-5-thread-1",
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
            "name": "RxComputationThreadPool-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "ScionFrontendApi",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
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
            "name": "heartbeat-information-executor",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "arch_disk_io_3",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "pool-16-thread-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp ConnectionPool",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "com.android.okhttp.ConnectionPool$1.run(ConnectionPool.java:106)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1137)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "arch_disk_io_0",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
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
            "name": "RxCachedThreadScheduler-4",
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
            "name": "DefaultDispatcher-worker-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:357)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.park(CoroutineScheduler.kt:856)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.tryPark(CoroutineScheduler.kt:801)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:749)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:702)"
            ]
          },
          {
            "name": "WM.task-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxCachedThreadScheduler-1",
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
      },
      {
        "id": "00805630-9158-4cd4-9e0c-2bf904f8fa5a",
        "session_id": "bcafd264-43eb-433b-8851-00306ecc2706",
        "timestamp": "2024-04-29T12:08:25.33Z",
        "type": "exception",
        "attribute": {
          "installation_id": "b0ba2ee2-aae9-4cb1-b08b-82c1aadee68c",
          "app_version": "7.62",
          "app_build": "9223",
          "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
          "network_generation": ""
        },
        "exception": {
          "title": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>",
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
          {
            "name": "msr-cmu",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxCachedThreadScheduler-4",
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
            "name": "DefaultDispatcher-worker-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:357)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.park(CoroutineScheduler.kt:856)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.tryPark(CoroutineScheduler.kt:801)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:749)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:702)"
            ]
          },
          {
            "name": "GmsDynamite",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)",
              "java.lang.Object.wait(Object.java:568)",
              "com.google.android.gms.dynamite.zza.run(com.google.android.gms:play-services-basement@@18.3.0:2)"
            ]
          },
          {
            "name": "Thread-9",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)",
              "java.lang.Object.wait(Object.java:568)",
              "com.automattic.android.tracks.TracksClient$3.run(TracksClient.java:224)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "Thread-7",
            "frames": [
              "com.automattic.android.tracks.TracksClient$1.run(TracksClient.java:112)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "heartbeat-information-executor",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxCachedThreadScheduler-3",
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
            "name": "kotlinx.coroutines.DefaultExecutor",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "kotlinx.coroutines.DefaultExecutor.run(DefaultExecutor.kt:118)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxCachedWorkerPoolEvictor-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "WM.task-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "pool-5-thread-1",
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
            "name": "RxSchedulerPurge-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "Thread-10",
            "frames": [
              "com.automattic.android.tracks.TracksClient$5.run(TracksClient.java:390)",
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
        ]
      },
      {
        "id": "e2196f50-1d0b-44bb-a4f8-6011dec209e6",
        "session_id": "b14625e1-c5bd-41eb-ae62-e9ad8e3071be",
        "timestamp": "2024-04-29T12:07:34.194Z",
        "type": "exception",
        "attribute": {
          "installation_id": "d96cd6d5-0730-4aa4-8eec-3e580e9819ec",
          "app_version": "7.62",
          "app_build": "9223",
          "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
          "network_generation": ""
        },
        "exception": {
          "title": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>",
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
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
            "name": "RxSchedulerPurge-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "pool-5-thread-1",
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
            "name": "firebase-installations-executor-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "arch_disk_io_2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "WM.task-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
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
            "name": "heartbeat-information-executor",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
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
            "name": "arch_disk_io_3",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "ScionFrontendApi",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "DefaultDispatcher-worker-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:357)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.park(CoroutineScheduler.kt:856)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.tryPark(CoroutineScheduler.kt:801)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:749)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:702)"
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
            "name": "RxCachedWorkerPoolEvictor-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "GmsDynamite",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)",
              "java.lang.Object.wait(Object.java:568)",
              "com.google.android.gms.dynamite.zza.run(com.google.android.gms:play-services-basement@@18.3.0:2)"
            ]
          }
        ]
      },
      {
        "id": "b8f0190e-ed24-46ec-9d9d-1c6ad68302c0",
        "session_id": "b5d0f1f6-01ef-4ae3-b24c-50cfb48411fd",
        "timestamp": "2024-04-29T12:07:32.186Z",
        "type": "exception",
        "attribute": {
          "installation_id": "d96cd6d5-0730-4aa4-8eec-3e580e9819ec",
          "app_version": "7.62",
          "app_build": "9223",
          "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
          "network_generation": ""
        },
        "exception": {
          "title": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>",
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
          {
            "name": "pool-5-thread-1",
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
            "name": "RxCachedThreadScheduler-1",
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
            "name": "Measurement Worker",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)"
            ]
          },
          {
            "name": "AsyncTask #1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:461)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)",
              "java.util.concurrent.SynchronousQueue.take(SynchronousQueue.java:922)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "OkHttp ConnectionPool",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "com.android.okhttp.ConnectionPool$1.run(ConnectionPool.java:106)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1137)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "Thread-7",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)",
              "java.lang.Object.wait(Object.java:568)",
              "com.automattic.android.tracks.TracksClient$2.run(TracksClient.java:193)",
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
            "name": "RxCachedThreadScheduler-3",
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
            "name": "RxCachedThreadScheduler-2",
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
            "name": "pool-6-thread-1",
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
            "name": "RxCachedWorkerPoolEvictor-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "WM.task-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          }
        ]
      },
      {
        "id": "2e8876ab-df6b-4325-b21a-1d04fdb03c2c",
        "session_id": "6c122af3-e411-45f5-963e-dbf210f5ec38",
        "timestamp": "2024-04-29T12:07:30.986Z",
        "type": "exception",
        "attribute": {
          "installation_id": "d96cd6d5-0730-4aa4-8eec-3e580e9819ec",
          "app_version": "7.62",
          "app_build": "9223",
          "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
          "network_generation": ""
        },
        "exception": {
          "title": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>",
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
          {
            "name": "pool-4-thread-1",
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
            "name": "pool-6-thread-2",
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
            "name": "DefaultDispatcher-worker-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:357)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.park(CoroutineScheduler.kt:856)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.tryPark(CoroutineScheduler.kt:801)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:749)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:702)"
            ]
          },
          {
            "name": "pool-21-thread-1",
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
            "name": "kotlinx.coroutines.DefaultExecutor",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "kotlinx.coroutines.DefaultExecutor.run(DefaultExecutor.kt:118)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxComputationThreadPool-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "DefaultDispatcher-worker-3",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:357)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.park(CoroutineScheduler.kt:856)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.tryPark(CoroutineScheduler.kt:801)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:749)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:702)"
            ]
          },
          {
            "name": "pool-5-thread-1",
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
            "name": "msr-cmu",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxCachedThreadScheduler-2",
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
            "name": "Thread-2",
            "frames": [
              "java.lang.Thread.sleep(Thread.java:-2)",
              "java.lang.Thread.sleep(Thread.java:450)",
              "java.lang.Thread.sleep(Thread.java:355)",
              "sh.measure.android.anr.ANRWatchDog.run(ANRWatchDog.kt:70)"
            ]
          },
          {
            "name": "Okio Watchdog",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2211)",
              "okio.AsyncTimeout$Companion.awaitTimeout$okio(AsyncTimeout.kt:320)",
              "okio.AsyncTimeout$Watchdog.run(AsyncTimeout.kt:186)"
            ]
          },
          {
            "name": "firebase-installations-executor-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "Thread-6",
            "frames": [
              "com.automattic.android.tracks.TracksClient$1.run(TracksClient.java:112)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          }
        ]
      },
      {
        "id": "7b9e79ab-fac4-406e-8e92-31e93ef367fd",
        "session_id": "284cb4bb-68bc-4069-9788-f2e2b7839885",
        "timestamp": "2024-04-29T12:07:28.835Z",
        "type": "exception",
        "attribute": {
          "installation_id": "d96cd6d5-0730-4aa4-8eec-3e580e9819ec",
          "app_version": "7.62",
          "app_build": "9223",
          "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
          "network_generation": ""
        },
        "exception": {
          "title": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>",
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
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
            "name": "RxSchedulerPurge-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "pool-5-thread-1",
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
            "name": "arch_disk_io_2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
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
              "okio.AsyncTimeout$Companion.awaitTimeout$okio(AsyncTimeout.kt:320)",
              "okio.AsyncTimeout$Watchdog.run(AsyncTimeout.kt:186)"
            ]
          },
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
            "name": "heartbeat-information-executor",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
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
            "name": "arch_disk_io_3",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)",
              "java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "ScionFrontendApi",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "DefaultDispatcher-worker-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:357)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.park(CoroutineScheduler.kt:856)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.tryPark(CoroutineScheduler.kt:801)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:749)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:702)"
            ]
          },
          {
            "name": "Measurement Worker",
            "frames": [
              "android.os.BinderProxy.transactNative(BinderProxy.java:-2)",
              "android.os.BinderProxy.transact(BinderProxy.java:584)",
              "android.content.pm.IPackageManager$Stub$Proxy.isInstantApp(IPackageManager.java:7213)",
              "android.app.ApplicationPackageManager.isInstantApp(ApplicationPackageManager.java:1323)",
              "android.app.ApplicationPackageManager.isInstantApp(ApplicationPackageManager.java:1317)",
              "java.util.concurrent.Executors$RunnableAdapter.call(Executors.java:463)",
              "java.util.concurrent.FutureTask.run(FutureTask.java:264)"
            ]
          },
          {
            "name": "RxCachedWorkerPoolEvictor-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "GmsDynamite",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)",
              "java.lang.Object.wait(Object.java:568)",
              "com.google.android.gms.dynamite.zza.run(com.google.android.gms:play-services-basement@@18.3.0:2)"
            ]
          }
        ]
      },
      {
        "id": "ee10115d-b076-4533-8138-99b6800d5d6a",
        "session_id": "8b336778-803d-41fe-88d7-4eee6f8ec194",
        "timestamp": "2024-04-29T12:07:25.764Z",
        "type": "exception",
        "attribute": {
          "installation_id": "d96cd6d5-0730-4aa4-8eec-3e580e9819ec",
          "app_version": "7.62",
          "app_build": "9223",
          "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
          "network_generation": ""
        },
        "exception": {
          "title": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>",
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
          {
            "name": "pool-4-thread-1",
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
            "name": "RxCachedThreadScheduler-1",
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
            "name": "pool-5-thread-1",
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
            "name": "DefaultDispatcher-worker-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:357)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.park(CoroutineScheduler.kt:856)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.tryPark(CoroutineScheduler.kt:801)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:749)",
              "kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:702)"
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
          },
          {
            "name": "AsyncTask #1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)",
              "java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:461)",
              "java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)",
              "java.util.concurrent.SynchronousQueue.take(SynchronousQueue.java:922)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "msr-cmu",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
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
            "name": "msr-eh",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "heartbeat-information-executor",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "firebase-installations-executor-2",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.LinkedBlockingQueue.poll(LinkedBlockingQueue.java:458)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "Thread-7",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "java.lang.Object.wait(Object.java:442)",
              "java.lang.Object.wait(Object.java:568)",
              "com.automattic.android.tracks.TracksClient$2.run(TracksClient.java:193)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "RxComputationThreadPool-1",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
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
- Accepted query parameters
  - `from` - ISO8601 timestamp to include crashes after this time.
  - `to` - ISO8601 timestamp to include crashes before this time.
  - `versions` - List of comma separated version identifier strings to return only matching crashes.
  - `version_codes` - List of comma separated version codes to return only matching crashes.
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

### GET `/apps/:id/anrGroups/plots/instances`

Fetch an app's ANR overview instances plot aggregated by date range & version.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` (_optional_) - Start time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `to` (_optional_) - End time boundary for temporal filtering. ISO8601 Datetime string. If not passed, a default value is assumed.
  - `versions` (_optional_) - List of comma separated version identifier strings to return crash groups that have events matching the version.
  - `version_codes` (_optional_) - List of comma separated version codes to return crash groups that have events matching the version code.
- Both `from` and `to` **MUST** be present when specifyng date range.
- Both `version` and `version_codes` **MUST** be present when specifying versions.

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
        "id": "652411e0-ef80-4fc5-bb0c-0cff32c6c6ff",
        "session_id": "cfcabb5f-11f2-4264-9d8e-b0fa2a7f5468",
        "timestamp": "2024-05-24T08:15:35.101Z",
        "type": "anr",
        "attribute": {
          "installation_id": "d9731194-11d5-4c39-9927-da33c18990d6",
          "app_version": "1.0",
          "app_build": "1",
          "app_unique_id": "sh.measure.sample",
          "measure_sdk_version": "0.1.0",
          "platform": "android",
          "thread_name": "Thread-3",
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
        "anr": {
          "title": "sh.measure.android.anr.AnrError: Application Not Responding for at least 5s",
          "stacktrace": "sh.measure.android.anr.AnrError: Application Not Responding for at least 5s\n\tat sh.measure.sample.ExceptionDemoActivity.deadLock$lambda$10(ExceptionDemoActivity.kt:66)\n\tat android.os.Handler.handleCallback(Handler.java:942)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
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
            "name": "msr-cmu",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
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
          },
          {
            "name": "Thread-3",
            "frames": [
              "dalvik.system.VMStack.getThreadStackTrace(VMStack.java:-2)",
              "java.lang.Thread.getStackTrace(Thread.java:1841)",
              "java.lang.Thread.getAllStackTraces(Thread.java:1909)",
              "sh.measure.android.exceptions.ExceptionFactory.createMeasureException(ExceptionFactory.java:36)",
              "sh.measure.android.anr.AnrCollector.toMeasureException(AnrCollector.kt:48)",
              "sh.measure.android.anr.AnrCollector.onAnrDetected(AnrCollector.kt:38)",
              "sh.measure.android.NativeBridgeImpl.notifyAnrDetected(NativeBridge.kt:64)"
            ]
          },
          {
            "name": "msr-eh",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)",
              "java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          }
        ]
      },
      {
        "id": "da53931e-fe29-4897-8ec7-2911e8985b4d",
        "session_id": "9e4c578e-bb32-4f07-b721-8fd03730f9d4",
        "timestamp": "2024-05-24T08:10:15.768Z",
        "type": "anr",
        "attribute": {
          "installation_id": "f8ce8c0b-ae72-44be-ad13-9feff7365aae",
          "app_version": "1.0",
          "app_build": "1",
          "app_unique_id": "sh.measure.sample",
          "measure_sdk_version": "0.1.0",
          "platform": "android",
          "thread_name": "Thread-3",
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
        "anr": {
          "title": "sh.measure.android.anr.AnrError: Application Not Responding for at least 5s",
          "stacktrace": "sh.measure.android.anr.AnrError: Application Not Responding for at least 5s\n\tat sh.measure.sample.ExceptionDemoActivity.deadLock$lambda$10(ExceptionDemoActivity.kt:68)\n\tat android.os.Handler.handleCallback(Handler.java:942)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)"
        },
        "threads": [
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
            "name": "Okio Watchdog",
            "frames": [
              "jdk.internal.misc.Unsafe.park(Unsafe.java:-2)",
              "java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)",
              "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2211)",
              "okhttp3.internal.platform.BouncyCastlePlatform.configureTlsExtensions(BouncyCastlePlatform.kt:99)",
              "okio.AsyncTimeout$Watchdog.run(AsyncTimeout.kt:211)"
            ]
          },
          {
            "name": "msr-cmu",
            "frames": [
              "android.os.Debug.getMemoryInfo(Debug.java:-2)",
              "sh.measure.android.utils.DefaultDebugProvider.populateMemoryInfo(DefaultDebugProvider.java:21)",
              "sh.measure.android.performance.DefaultMemoryReader.totalPss(MemoryReader.kt:69)",
              "sh.measure.android.performance.MemoryUsageCollector.trackMemoryUsage(MemoryUsageCollector.kt:55)",
              "sh.measure.android.performance.MemoryUsageCollector.register$lambda$0(MemoryUsageCollector.kt:30)",
              "java.util.concurrent.Executors$RunnableAdapter.call(Executors.java:463)",
              "java.util.concurrent.FutureTask.runAndReset(FutureTask.java:305)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$ScheduledFutureTask.run(ScheduledThreadPoolExecutor.java:308)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1137)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
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
            "name": "x2.A TaskRunner",
            "frames": [
              "java.lang.Object.wait(Object.java:-2)",
              "okhttp3.internal.concurrent.TaskRunner.awaitTaskToRun(TaskRunner.kt:223)",
              "okhttp3.internal.concurrent.TaskRunner$runnable$1.run(TaskRunner.kt:59)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1137)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
              "java.lang.Thread.run(Thread.java:1012)"
            ]
          },
          {
            "name": "APP: Locker",
            "frames": [
              "java.lang.Thread.sleep(Thread.java:-2)",
              "java.lang.Thread.sleep(Thread.java:450)",
              "java.lang.Thread.sleep(Thread.java:355)",
              "sh.measure.sample.ExceptionDemoActivity.sleep(ExceptionDemoActivity.kt:86)",
              "sh.measure.sample.ExceptionDemoActivity.access$sleep(ExceptionDemoActivity.kt:12)",
              "sh.measure.sample.ExceptionDemoActivity$LockerThread.run(ExceptionDemoActivity.kt:80)"
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
            "name": "msr-ee",
            "frames": [
              "android.database.sqlite.SQLiteConnection.nativeExecuteForCursorWindow(SQLiteConnection.java:-2)",
              "android.database.sqlite.SQLiteConnection.executeForCursorWindow(SQLiteConnection.java:1024)",
              "android.database.sqlite.SQLiteSession.executeForCursorWindow(SQLiteSession.java:838)",
              "android.database.sqlite.SQLiteQuery.fillWindow(SQLiteQuery.java:62)",
              "android.database.sqlite.SQLiteCursor.fillWindow(SQLiteCursor.java:145)",
              "android.database.sqlite.SQLiteCursor.getCount(SQLiteCursor.java:132)",
              "android.database.AbstractCursor.moveToPosition(AbstractCursor.java:238)",
              "android.database.AbstractCursor.moveToNext(AbstractCursor.java:287)",
              "sh.measure.android.storage.DatabaseImpl.getUnBatchedEventsWithAttachmentSize(Database.kt:225)",
              "sh.measure.android.storage.Database$DefaultImpls.getUnBatchedEventsWithAttachmentSize$default(Database.kt:32)",
              "sh.measure.android.exporter.BatchCreatorImpl.create(BatchCreator.kt:36)",
              "sh.measure.android.exporter.PeriodicEventExporterImpl.processNewBatchIfTimeElapsed(PeriodicEventExporter.kt:103)",
              "sh.measure.android.exporter.PeriodicEventExporterImpl.processBatches(PeriodicEventExporter.kt:88)",
              "sh.measure.android.exporter.PeriodicEventExporterImpl.exportEvents$lambda$0(PeriodicEventExporter.kt:78)",
              "java.util.concurrent.Executors$RunnableAdapter.call(Executors.java:463)",
              "java.util.concurrent.FutureTask.run(FutureTask.java:264)",
              "java.util.concurrent.ScheduledThreadPoolExecutor$ScheduledFutureTask.run(ScheduledThreadPoolExecutor.java:307)",
              "java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1137)",
              "java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)",
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
- Accepted query parameters
  - `from` - ISO8601 timestamp to include crashes after this time.
  - `to` - ISO8601 timestamp to include crashes before this time.
  - `versions` - List of comma separated version identifier strings to return only matching crashes.
  - `version_codes` - List of comma separated version codes to return only matching crashes.
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
    "app_id": "fddf4d6d-1df1-45f8-8bc7-9730f2236cb0",
    "attribute": {
      "installation_id": "b0ba2ee2-aae9-4cb1-b08b-82c1aadee68c",
      "app_version": "7.62",
      "app_build": "9223",
      "app_unique_id": "au.com.shiftyjelly.pocketcasts.debug",
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
        "timestamp": "2024-04-29T12:08:24.12Z",
        "value": 12.666666666666668
      }
    ],
    "duration": 1210,
    "memory_usage": [
      {
        "java_max_heap": 524288,
        "java_total_heap": 524288,
        "java_free_heap": 512698,
        "total_pss": 73403,
        "rss": 148836,
        "native_total_heap": 11748,
        "native_free_heap": 1293,
        "interval_config": 2000,
        "timestamp": "2024-04-29T12:08:24.127Z"
      }
    ],
    "session_id": "bcafd264-43eb-433b-8851-00306ecc2706",
    "threads": {
      "main": [
        {
          "event_type": "lifecycle_activity",
          "thread_name": "main",
          "type": "created",
          "class_name": "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
          "intent": "",
          "saved_instance_state": false,
          "timestamp": "2024-04-29T12:08:24.822Z"
        },
        {
          "event_type": "lifecycle_fragment",
          "thread_name": "main",
          "type": "attached",
          "class_name": "au.com.shiftyjelly.pocketcasts.player.view.PlayerContainerFragment",
          "parent_activity": "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
          "tag": "",
          "timestamp": "2024-04-29T12:08:25.024Z"
        },
        {
          "event_type": "lifecycle_fragment",
          "thread_name": "main",
          "type": "attached",
          "class_name": "au.com.shiftyjelly.pocketcasts.player.view.UpNextFragment",
          "parent_activity": "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
          "tag": "",
          "timestamp": "2024-04-29T12:08:25.141Z"
        },
        {
          "event_type": "lifecycle_app",
          "thread_name": "main",
          "type": "foreground",
          "timestamp": "2024-04-29T12:08:25.291Z"
        },
        {
          "event_type": "lifecycle_fragment",
          "thread_name": "main",
          "type": "attached",
          "class_name": "au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment",
          "parent_activity": "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
          "tag": "au.com.shiftyjelly.pocketcasts.navigator|au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment||f7816a02-2bbc-4b01-a87c-9e41de9e4749|",
          "timestamp": "2024-04-29T12:08:25.309Z"
        },
        {
          "event_type": "exception",
          "type": "java.lang.IllegalStateException",
          "thread_name": "main",
          "handled": false,
          "stacktrace": "java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory.get(RxJava2CallAdapterFactory.java:118)\n\tat retrofit2.Retrofit.nextCallAdapter(Retrofit.java:253)\n\tat retrofit2.Retrofit.callAdapter(Retrofit.java:237)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:114)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalStateException: Single return type must be parameterized as Single<Foo> or Single<? extends Foo>\n\tat retrofit2.Utils.methodError(Utils.java:54)\n\tat retrofit2.HttpServiceMethod.createCallAdapter(HttpServiceMethod.java:116)\n\tat retrofit2.HttpServiceMethod.parseAnnotations(HttpServiceMethod.java:67)\n\tat retrofit2.ServiceMethod.parseAnnotations(ServiceMethod.java:39)\n\tat retrofit2.Retrofit.loadServiceMethod(Retrofit.java:202)\n\tat retrofit2.Retrofit$1.invoke(Retrofit.java:160)\n\tat java.lang.reflect.Proxy.invoke(Proxy.java:1006)\n\tat $Proxy10.getDiscoverFeedWithCategoriesAtTheTop(-1)\n\tat au.com.shiftyjelly.pocketcasts.servers.server.ListRepository.getDiscoverFeedWithCategoriesAtTheTop(ListRepository.kt:19)\n\tat au.com.shiftyjelly.pocketcasts.discover.viewmodel.DiscoverViewModel.loadData(DiscoverViewModel.kt:77)\n\tat au.com.shiftyjelly.pocketcasts.discover.view.DiscoverFragment.onCreateView(DiscoverFragment.kt:172)\n\tat androidx.fragment.app.Fragment.performCreateView(Fragment.java:3104)\n\tat androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:524)\n\tat androidx.fragment.app.FragmentStateManager.moveToExpectedState(FragmentStateManager.java:261)\n\tat androidx.fragment.app.FragmentManager.executeOpsTogether(FragmentManager.java:1890)\n\tat androidx.fragment.app.FragmentManager.removeRedundantOperationsAndExecute(FragmentManager.java:1814)\n\tat androidx.fragment.app.FragmentManager.execSingleAction(FragmentManager.java:1720)\n\tat androidx.fragment.app.BackStackRecord.commitNow(BackStackRecord.java:317)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.addAndShowFragment(FragmentTransactionHandler.kt:149)\n\tat au.com.shiftyjelly.pocketcasts.navigation.FragmentTransactionHandler.handle(FragmentTransactionHandler.kt:43)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:40)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate$onActivityStart$1.invoke(ActivityDelegate.kt:39)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart$lambda$0(ActivityDelegate.kt:39)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:63)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\nCaused by: java.lang.IllegalArgumentException: Unable to create call adapter for class io.reactivex.Single\n    for method ListWebService.getDiscoverFeedWithCategoriesAtTheTop\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:704)\n\tat io.reactivex.internal.functions.Functions$OnErrorMissingConsumer.accept(Functions.java:701)\n\tat io.reactivex.internal.observers.LambdaObserver.onError(LambdaObserver.java:77)\n\tat io.reactivex.internal.observers.LambdaObserver.onNext(LambdaObserver.java:67)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.drain(UnicastWorkSubject.java:258)\n\tat hu.akarnokd.rxjava2.subjects.UnicastWorkSubject.subscribeActual(UnicastWorkSubject.java:159)\n\tat io.reactivex.Observable.subscribe(Observable.java:12284)\n\tat io.reactivex.Observable.subscribe(Observable.java:12270)\n\tat io.reactivex.Observable.subscribe(Observable.java:12172)\n\tat au.com.shiftyjelly.pocketcasts.navigation.ActivityDelegate.onActivityStart(ActivityDelegate.kt:39)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat androidx.lifecycle.ClassesInfoCache$MethodReference.invokeCallback(ClassesInfoCache.java:222)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeMethodsForEvent(ClassesInfoCache.java:199)\n\tat androidx.lifecycle.ClassesInfoCache$CallbackInfo.invokeCallbacks(ClassesInfoCache.java:190)\n\tat androidx.lifecycle.ReflectiveGenericLifecycleObserver.onStateChanged(ReflectiveGenericLifecycleObserver.java:40)\n\tat androidx.lifecycle.LifecycleRegistry$ObserverWithState.dispatchEvent(LifecycleRegistry.kt:322)\n\tat androidx.lifecycle.LifecycleRegistry.forwardPass(LifecycleRegistry.kt:258)\n\tat androidx.lifecycle.LifecycleRegistry.sync(LifecycleRegistry.kt:294)\n\tat androidx.lifecycle.LifecycleRegistry.moveToState(LifecycleRegistry.kt:143)\n\tat androidx.lifecycle.LifecycleRegistry.handleLifecycleEvent(LifecycleRegistry.kt:126)\n\tat androidx.lifecycle.ReportFragment$Companion.dispatch$lifecycle_runtime_release(ReportFragment.kt:190)\n\tat androidx.lifecycle.ReportFragment$LifecycleCallbacks.onActivityPostStarted(ReportFragment.kt:119)\n\tat android.app.Activity.dispatchActivityPostStarted(Activity.java:1418)\n\tat android.app.Activity.performStart(Activity.java:8367)\n\tat android.app.ActivityThread.handleStartActivity(ActivityThread.java:3670)\n\tat android.app.servertransaction.TransactionExecutor.performLifecycleSequence(TransactionExecutor.java:221)\n\tat android.app.servertransaction.TransactionExecutor.cycleToPath(TransactionExecutor.java:201)\n\tat android.app.servertransaction.TransactionExecutor.executeLifecycleState(TransactionExecutor.java:173)\n\tat android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:97)\n\tat android.app.ActivityThread$H.handleMessage(ActivityThread.java:2307)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)",
          "foreground": true,
          "timestamp": "2024-04-29T12:08:25.33Z"
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
