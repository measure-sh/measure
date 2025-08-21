# Dashboard REST API Documentation <!-- omit in toc -->

Find all the endpoints, resources and detailed documentation for Measure Dashboard REST APIs.

## Contents <!-- omit in toc -->

- [Auth](#auth)
  - [POST `/auth/github`](#post-authgithub)
    - [Usage Notes](#usage-notes)
    - [Request Body](#request-body)
    - [Content Type](#content-type)
    - [Response Body](#response-body)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting)
  - [POST `/auth/google`](#post-authgoogle)
    - [Usage Notes](#usage-notes-1)
    - [Request Body](#request-body-1)
    - [Content Type](#content-type-1)
    - [Response Body](#response-body-1)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-1)
  - [POST `/auth/validateInvite`](#post-validateinvite)
    - [Usage Notes](#usage-notes-2)
    - [Request Body](#request-body-2)
    - [Content Type](#content-type-2)
    - [Response Body](#response-body-2)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-2)
  - [POST `/auth/refresh`](#post-authrefresh)
    - [Usage Notes](#usage-notes-3)
    - [Authorization \& Content Type](#authorization--content-type)
    - [Response Body](#response-body-3)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-3)
  - [GET `/auth/session`](#get-authsession)
    - [Usage Notes](#usage-notes-4)
    - [Authorization \& Content Type](#authorization--content-type-1)
    - [Response Body](#response-body-4)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-4)
  - [DELETE `/auth/signout`](#delete-authsignout)
    - [Usage Notes](#usage-notes-5)
    - [Authorization \& Content Type](#authorization--content-type-2)
    - [Response Body](#response-body-5)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-5)
- [Apps](#apps)
  - [GET `/apps/:id/journey`](#get-appsidjourney)
    - [Usage Notes](#usage-notes-6)
    - [Authorization \& Content Type](#authorization--content-type-3)
    - [Response Body](#response-body-6)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-6)
  - [GET `/apps/:id/metrics`](#get-appsidmetrics)
    - [Usage Notes](#usage-notes-7)
    - [Authorization \& Content Type](#authorization--content-type-4)
    - [Response Body](#response-body-7)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-7)
  - [GET `/apps/:id/filters`](#get-appsidfilters)
    - [Usage Notes](#usage-notes-8)
    - [Authorization \& Content Type](#authorization--content-type-5)
    - [Response Body](#response-body-8)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-8)
  - [GET `/apps/:id/crashGroups`](#get-appsidcrashgroups)
    - [Usage Notes](#usage-notes-9)
    - [Authorization \& Content Type](#authorization--content-type-6)
    - [Response Body](#response-body-9)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-9)
  - [GET `/apps/:id/crashGroups/plots/instances`](#get-appsidcrashgroupsplotsinstances)
    - [Usage Notes](#usage-notes-10)
    - [Authorization \& Content Type](#authorization--content-type-7)
    - [Response Body](#response-body-10)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-10)
  - [GET `/apps/:id/crashGroups/:id/crashes`](#get-appsidcrashgroupsidcrashes)
    - [Usage Notes](#usage-notes-11)
    - [Authorization \& Content Type](#authorization--content-type-8)
    - [Response Body](#response-body-11)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-11)
  - [GET `/apps/:id/crashGroups/:id/plots/instances`](#get-appsidcrashgroupsidplotsinstances)
    - [Usage Notes](#usage-notes-12)
    - [Authorization \& Content Type](#authorization--content-type-9)
    - [Response Body](#response-body-12)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-12)
  - [GET `/apps/:id/crashGroups/:id/plots/journey`](#get-appsidcrashgroupsidplotsjourney)
    - [Usage Notes](#usage-notes-13)
    - [Authorization \& Content Type](#authorization--content-type-10)
    - [Response Body](#response-body-13)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-13)
  - [GET `/apps/:id/anrGroups`](#get-appsidanrgroups)
    - [Usage Notes](#usage-notes-14)
    - [Authorization \& Content Type](#authorization--content-type-11)
    - [Response Body](#response-body-14)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-14)
  - [GET `/apps/:id/anrGroups/plots/instances`](#get-appsidanrgroupsplotsinstances)
    - [Usage Notes](#usage-notes-15)
    - [Authorization \& Content Type](#authorization--content-type-12)
    - [Response Body](#response-body-15)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-15)
  - [GET `/apps/:id/anrGroups/:id/anrs`](#get-appsidanrgroupsidanrs)
    - [Usage Notes](#usage-notes-16)
    - [Authorization \& Content Type](#authorization--content-type-13)
    - [Response Body](#response-body-16)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-16)
  - [GET `/apps/:id/anrGroups/:id/plots/instances`](#get-appsidanrgroupsidplotsinstances)
    - [Usage Notes](#usage-notes-17)
    - [Authorization \& Content Type](#authorization--content-type-14)
    - [Response Body](#response-body-17)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-17)
  - [GET `/apps/:id/anrGroups/:id/plots/journey`](#get-appsidanrgroupsidplotsjourney)
    - [Usage Notes](#usage-notes-18)
    - [Authorization \& Content Type](#authorization--content-type-15)
    - [Response Body](#response-body-18)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-18)
  - [GET `/apps/:id/sessions`](#get-appsidsessions)
    - [Usage Notes](#usage-notes-19)
    - [Authorization \& Content Type](#authorization--content-type-16)
    - [Response Body](#response-body-19)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-19)
  - [GET `/apps/:id/sessions/:id`](#get-appsidsessionsid)
    - [Usage Notes](#usage-notes-20)
    - [Authorization \& Content Type](#authorization--content-type-17)
    - [Response Body](#response-body-20)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-20)
  - [GET `/apps/:id/alertPrefs`](#get-appsidalertprefs)
    - [Usage Notes](#usage-notes-21)
    - [Authorization \& Content Type](#authorization--content-type-18)
    - [Response Body](#response-body-21)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-21)
  - [PATCH `/apps/:id/alertPrefs`](#patch-appsidalertprefs)
    - [Usage Notes](#usage-notes-22)
    - [Request body](#request-body-3)
    - [Authorization \& Content Type](#authorization--content-type-19)
    - [Response Body](#response-body-22)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-22)
  - [PATCH `/apps/:id/rename`](#patch-appsidrename)
    - [Usage Notes](#usage-notes-23)
    - [Request body](#request-body-4)
    - [Authorization \& Content Type](#authorization--content-type-20)
    - [Response Body](#response-body-23)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-23)
  - [GET `/apps/:id/settings`](#get-appsidsettings)
    - [Usage Notes](#usage-notes-24)
    - [Authorization \& Content Type](#authorization--content-type-21)
    - [Response Body](#response-body-24)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-24)
  - [PATCH `/apps/:id/settings`](#patch-appsidsettings)
    - [Usage Notes](#usage-notes-25)
    - [Request body](#request-body-5)
    - [Authorization \& Content Type](#authorization--content-type-22)
    - [Response Body](#response-body-25)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-25)
  - [POST `/apps/:id/shortFilters`](#post-appsidshortfilters)
    - [Usage Notes](#usage-notes-26)
    - [Request body](#request-body-6)
    - [Authorization \& Content Type](#authorization--content-type-23)
    - [Response Body](#response-body-26)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-26)
  - [GET `/apps/:id/spans/roots/names`](#get-appsidspansrootsnames)
    - [Usage Notes](#usage-notes-27)
    - [Authorization \& Content Type](#authorization--content-type-24)
    - [Response Body](#response-body-27)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-27)
  - [GET `/apps/:id/spans`](#get-appsidspans)
    - [Usage Notes](#usage-notes-28)
    - [Authorization \& Content Type](#authorization--content-type-25)
    - [Response Body](#response-body-28)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-28)
  - [GET `/apps/:id/spans/plots/metrics`](#get-appsidspansplotsmetrics)
    - [Usage Notes](#usage-notes-29)
    - [Authorization \& Content Type](#authorization--content-type-26)
    - [Response Body](#response-body-29)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-29)
  - [GET `/apps/:id/traces/:traceId`](#get-appsidtracestraceid)
    - [Usage Notes](#usage-notes-30)
    - [Authorization \& Content Type](#authorization--content-type-27)
    - [Response Body](#response-body-30)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-30)
  - [GET `/apps/:id/bugReports`](#get-appsidbugreports)
    - [Usage Notes](#usage-notes-31)
    - [Authorization \& Content Type](#authorization--content-type-28)
    - [Response Body](#response-body-31)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-31)
  - [GET `/apps/:id/bugReports/plots/instances`](#get-appsidbugreportsplotsinstances)
    - [Usage Notes](#usage-notes-32)
    - [Authorization \& Content Type](#authorization--content-type-29)
    - [Response Body](#response-body-32)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-32)
  - [GET `/apps/:id/bugReports/:bugReportId`](#get-appsidbugreportsbugreportid)
    - [Usage Notes](#usage-notes-33)
    - [Authorization \& Content Type](#authorization--content-type-30)
    - [Response Body](#response-body-33)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-33)
  - [PATCH `/apps/:id/bugReports/:bugReportId`](#patch-appsidbugreportsbugreportid)
    - [Usage Notes](#usage-notes-34)
    - [Request body](#request-body-7)
    - [Authorization \& Content Type](#authorization--content-type-31)
    - [Response Body](#response-body-34)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-34)
  - [GET `/apps/:id/alerts`](#get-appsidalerts)
    - [Usage Notes](#usage-notes-35)
    - [Authorization \& Content Type](#authorization--content-type-32)
    - [Response Body](#response-body-35)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-35)
  - [GET `/apps/:id/sessionTargetingRules`](#get-appsidsessiontargetingrules)
    - [Usage Notes](#usage-notes-35)
    - [Authorization \& Content Type](#authorization--content-type-33)
    - [Response Body](#response-body-35)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-35)
  - [GET `/apps/:id/sessionTargetingRules/:ruleId`](#get-appsidsessiontargetingrulesruleid)
    - [Usage Notes](#usage-notes-36)
    - [Authorization \& Content Type](#authorization--content-type-34)
    - [Response Body](#response-body-36)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-36) 
  - [POST `/apps/:id/sessionTargetingRules`](#post-appsidsessiontargetingrules)
    - [Usage Notes](#usage-notes-37)
    - [Authorization \& Content Type](#authorization--content-type-35)
    - [Response Body](#response-body-37)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-37)
  - [PATCH `/apps/:id/sessionTargetingRules/:ruleId`](#patch-appsidsessiontargetingrulesruleid)
    - [Usage Notes](#usage-notes-38)
    - [Authorization \& Content Type](#authorization--content-type-36)
    - [Response Body](#response-body-38)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-38)
  - [GET `/apps/:id/sessionTargetingRules/config`](#get-appsidsessiontargetingrulesconfig)
    - [Usage Notes](#usage-notes-39)
    - [Authorization \& Content Type](#authorization--content-type-37)
    - [Response Body](#response-body-39)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-39)

- [Teams](#teams)
  - [POST `/teams`](#post-teams)
    - [Authorization \& Content Type](#authorization--content-type-33)
    - [Request Body](#request-body-8)
    - [Usage Notes](#usage-notes-36)
    - [Response Body](#response-body-36)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-36)
  - [GET `/teams`](#get-teams)
    - [Authorization \& Content Type](#authorization--content-type-34)
    - [Response Body](#response-body-37)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-37)
  - [GET `/teams/:id/apps`](#get-teamsidapps)
    - [Usage Notes](#usage-notes-37)
    - [Authorization \& Content Type](#authorization--content-type-35)
    - [Response Body](#response-body-38)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-38)
  - [GET `/teams/:id/apps/:id`](#get-teamsidappsid)
    - [Usage Notes](#usage-notes-38)
    - [Authorization \& Content Type](#authorization--content-type-36)
    - [Response Body](#response-body-39)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-39)
  - [POST `/teams/:id/apps`](#post-teamsidapps)
    - [Usage Notes](#usage-notes-39)
    - [Request body](#request-body-9)
    - [Authorization \& Content Type](#authorization--content-type-37)
    - [Response Body](#response-body-40)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-40)
  - [GET `/teams/:id/invites`](#get-teamsidinvites)
    - [Usage Notes](#usage-notes-40)
    - [Authorization \& Content Type](#authorization--content-type-38)
    - [Response Body](#response-body-41)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-41)
  - [POST `/teams/:id/invite`](#post-teamsidinvite)
    - [Usage Notes](#usage-notes-41)
    - [Request body](#request-body-10)
    - [Authorization \& Content Type](#authorization--content-type-39)
    - [Response Body](#response-body-42)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-42)
  - [PATCH `/teams/:id/invite/:id`](#patch-teamsidinviteid)
    - [Usage Notes](#usage-notes-42)
    - [Authorization \& Content Type](#authorization--content-type-40)
    - [Response Body](#response-body-43)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-43)
  - [DELETE `/teams/:id/invite/:id`](#delete-teamsidinviteid)
    - [Usage Notes](#usage-notes-43)
    - [Authorization \& Content Type](#authorization--content-type-41)
    - [Response Body](#response-body-44)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-44)
  - [PATCH `/teams/:id/rename`](#patch-teamsidrename)
    - [Usage Notes](#usage-notes-44)
    - [Request body](#request-body-11)
    - [Authorization \& Content Type](#authorization--content-type-42)
    - [Response Body](#response-body-45)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-45)
  - [GET `/teams/:id/members`](#get-teamsidmembers)
    - [Usage Notes](#usage-notes-45)
    - [Authorization \& Content Type](#authorization--content-type-43)
    - [Response Body](#response-body-46)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-46)
  - [DELETE `/teams/:id/members/:id`](#delete-teamsidmembersid)
    - [Usage Notes](#usage-notes-46)
    - [Authorization \& Content Type](#authorization--content-type-44)
    - [Response Body](#response-body-47)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-47)
  - [PATCH `/teams/:id/members/:id/role`](#patch-teamsidmembersidrole)
    - [Usage Notes](#usage-notes-47)
    - [Request body](#request-body-12)
    - [Authorization \& Content Type](#authorization--content-type-45)
    - [Response Body](#response-body-48)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-48)
  - [GET `/teams/:id/authz`](#get-teamsidauthz)
    - [Usage Notes](#usage-notes-48)
    - [Authorization \& Content Type](#authorization--content-type-46)
    - [Response Body](#response-body-49)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-49)
  - [GET `/teams/:id/usage`](#get-teamsidusage)
    - [Usage Notes](#usage-notes-49)
    - [Authorization \& Content Type](#authorization--content-type-47)
    - [Response Body](#response-body-50)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-50)
  - [GET `/teams/:id/slack`](#get-teamsidslack)
    - [Usage Notes](#usage-notes-50)
    - [Authorization \& Content Type](#authorization--content-type-48)
    - [Response Body](#response-body-51)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-51)
  - [PATCH `/teams/:id/slack/status`](#patch-teamsidslackstatus)
    - [Usage Notes](#usage-notes-51)
    - [Request body](#request-body-13)
    - [Authorization \& Content Type](#authorization--content-type-49)
    - [Response Body](#response-body-52)
    - [Status Codes \& Troubleshooting](#status-codes--troubleshooting-52)

## Auth

- [**POST `/auth/github`**](#post-authgithub) - Sign in with Github.
- [**POST `/auth/google`**](#post-authgoogle) - Sign in with Google.
- [**POST `/auth/validateInvite`**](#post-validateInvite) - Validate invite.
- [**POST `/auth/refresh`**](#post-authrefresh) - Refresh session.
- [**GET `/auth/session`**](#get-authsession) - Fetch session.
- [**DELETE `/auth/signout`**](#delete-authsignout) - Sign out.

### POST `/auth/github`

Sign in with Github.

#### Usage Notes

- Should pass in type as "code" along with state and code received from Github.

#### Request Body

```json
{
 "type":"code","state":"eyJyYW5kb20iOiIxOGY0NDIzZjExY2FiM2ZkOTRiNDZlMzU0ZWU1MDNlZjEyODk1MmY3YzViMDgxNjczMDkwMzVhYzU3ZjNkYjgxIiwicGF0aCI6IiJ9","code":"ccd85e1fbfae2924588a"
}
  
```

#### Content Type

1. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**       | **Value**                       |
| -------------- | ------------------------------- |
| `Content-Type` | application/json; charset=utf-8 |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDUyMjU0ODQsImlhdCI6MTc0NTIyMzY4NCwiaXNzIjoibWVhc3VyZSIsIm90aSI6ImU0N2FjNDlkLTA2OTctNGU4NS04NjA3LTFhMzQ1MzZjMDRlMyIsInN1YiI6IjgzNTI4M2E1LWNkZGMtNDcyYi04NGFkLTVlYTMzMTllZmVlZCJ9.UA-rtIY8TPjB3gkt0xgxTTXWa84uB6nr9vMyg0gMnSI",
    "refresh_token": "yJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJleHAiOjE3NDU4Mjg0ODQsImp0aSI6ImYwY2NlMjViLTkyOWQtNGI4ZS1iOTgyLWM1YmRlOWJmZmJlYyJ9.1-meGfGQ8i9IlNxKXmBlDc4lEu-O63jG2vrd7yP0-j8",
    "session_id": "afae8473-2419-4303-a262-2aea520de295",
    "user_id": "835283a5-cddc-472b-84ad-5ea3319efeed",
    "own_team_id": "e47ac49d-0697-4e85-8607-1a34536c04e3"
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
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |  |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### POST `/auth/google`

Sign in with Google.

#### Usage Notes

- Should pass in credential, state and nonce received from Google.

#### Request Body

```json
{
  "credential":"eyJhbGciOiJSUzI1NiIsImtpZCI6ImMzN2RhNzVjOWZiZTE4YzJjZTkxMjViOWFhMWYzMDBkY2IzMWU4ZDkiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI3MTUwNjUzODk3NTYtMG5lamVnZnJhNmVyY28zdTE3MnZqZ2lib3QyYTZwNHYuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI3MTUwNjUzODk3NTYtMG5lamVnZnJhNmVyY28zdTE3MnZqZ2lib3QyYTZwNHYuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDAxNTg0ODAwMzg3MDM2ODQwMDQiLCJlbWFpbCI6ImFudXBjb3drdXI4OUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibm9uY2UiOiJhYzc3ZDhmZWExNjc4MzE2NTI0MTVhNGViZmNlZDViZDRjM2E0MzAyNmI0ZTVmNGVhZTYyMGRmMzhiMWM4YmJhIiwibmJmIjoxNzQ0OTgwNDY3LCJuYW1lIjoiQW51cCBDb3drdXIiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSnhYOUNxVm5EemktLUhFa1ZqSU5tbXY2dGpHM1Rlb3RPQWdYZTVpNFNNdVRCS3VYZ2g9czk2LWMiLCJnaXZlbl9uYW1lIjoiQW51cCIsImZhbWlseV9uYW1lIjoiQ293a3VyIiwiaWF0IjoxNzQ0OTgwNzY3LCJleHAiOjE3NDQ5ODQzNjcsImp0aSI6IjgwYTMxYjZjZjc3OTlkMWEwNTIyMGNlNzcyZjZlZDA2NTliMzZjYmQifQ.tsPn8osrQgLzO4XVn579S3aloF20oK8GHXLHSjg2NWmZeOtugoX51pWZiZSEZb_N9YDAwz4ld0oerd392uL79bkvzxaAWfhHa4-7XDIuOxlai3ekJbUkg07OzYpQ7vf2JQpPDeie54Zp45RRbV8xgUYzmdHi_h7WmfNX2n2Pdn0MidJdxCkCXlqQMxF-kN-VCb1yPiT78KhaWPufJRrtkCwpesE_LYMm1LMhr87zGawf8x8KOv_vMl_W1mZf8VyyVTxUlNhCxFqdMNq0rKChC2EuMGrwRVnCWOYzY0O6ff-2RL9OFFVxOQ8ferHgqNtlp6DtQFVLnypAoY0Kxb5PnQ","state":"eyJyYW5kb20iOiJiMGNkMTBjNzViOTI3NjQ1MmM4NTRlMzJiMjlkOTI1ZmI0YjkyNGI5ODFkZDQ0ZjM4OTMwYWQwYzU2YjEzMDk3IiwicGF0aCI6IiJ9","nonce":"e7d285dbf441b9a24228e00fe8188628"
}
```

#### Content Type

1. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**       | **Value**                       |
| -------------- | ------------------------------- |
| `Content-Type` | application/json; charset=utf-8 |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDUyMjU2NTksImlhdCI6MTc0NTIyMzg1OSwiaXNzIjoibWVhc3VyZSIsIm90aSI6ImU0N2FjNDlkLTA2OTctNGU4NS04NjA3LTFhMzQ1MzZjMDRlMyIsInN1YiI6IjgzNTI4M2E1LWNkZGMtNDcyYi04NGFkLTVlYTMzMTllZmVlZCJ9.XzbpImWw9GXFlIXHCu92QNsA1D8m_Y9ZFVDEDqG_wtM",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDU4Mjg2NTksImp0aSI6Ijg0Njk3ODhkLWVjNTEtNDdkNi1hM2RkLTRhYWY2NzI4ZmYzNyJ9.MeMIsk1KEHvPa2AAbDBQWqeKJwQcxbk1lXb7Mhcz-uQ",
    "session_id": "afae8473-2419-4303-a262-2aea520de295",
    "user_id": "835283a5-cddc-472b-84ad-5ea3319efeed",
    "own_team_id": "e47ac49d-0697-4e85-8607-1a34536c04e3"
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
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |  |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### POST `/auth/validateInvite`

Validate invite.

#### Usage Notes

- Should pass in Invite ID.

#### Request Body

```json
{
  "invite_id":"8e07edcf-92be-43c6-934e-c9cc96f2ddfb"
}
```

#### Content Type

1. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**       | **Value**                       |
| -------------- | ------------------------------- |
| `Content-Type` | application/json; charset=utf-8 |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "valid": true
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
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |  |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `410 Gone`     | Invite has expired.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### POST `/auth/refresh`

Refresh session.

#### Usage Notes

- Should pass in refresh token as cookies or in auth header.

#### Authorization & Content Type

1. (Optional) Set the session's refresh token in `Authorization: Bearer <refresh-token>` format unless you are using cookies to send refresh tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDUyMjU2NTksImlhdCI6MTc0NTIyMzg1OSwiaXNzIjoibWVhc3VyZSIsIm90aSI6ImU0N2FjNDlkLTA2OTctNGU4NS04NjA3LTFhMzQ1MzZjMDRlMyIsInN1YiI6IjgzNTI4M2E1LWNkZGMtNDcyYi04NGFkLTVlYTMzMTllZmVlZCJ9.XzbpImWw9GXFlIXHCu92QNsA1D8m_Y9ZFVDEDqG_wtM",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDU4Mjg2NTksImp0aSI6Ijg0Njk3ODhkLWVjNTEtNDdkNi1hM2RkLTRhYWY2NzI4ZmYzNyJ9.MeMIsk1KEHvPa2AAbDBQWqeKJwQcxbk1lXb7Mhcz-uQ"
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
| `401 Unauthorized`          | Either the user's refresh token is invalid or has expired.                                                             |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/auth/session`

Fetch session.

#### Usage Notes

- Only active sessions that have not been cleaned up will receive a response. Invalid sessions return an error.

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "user": {
        "id": "835283a5-cddc-472b-84ad-5ea3319efeed",
        "own_team_id": "e47ac49d-0697-4e85-8607-1a34536c04e3",
        "name": "Dummy User",
        "email": "dummy@gmail.com",
        "confirmed_at": "2024-06-19T22:14:49.77Z",
        "last_sign_in_at": "2024-06-19T22:14:49.77Z",
        "created_at": "2024-06-19T22:14:49.77Z",
        "updated_at": "2024-06-19T22:14:49.77Z",
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

### DELETE `/auth/signout`

Sign out.

#### Usage Notes

- Only active sessions that have not been cleaned up will receive a response. Invalid sessions return an error.

#### Authorization & Content Type

1. (Optional) Set the sessions's refresh token in `Authorization: Bearer <access-refresh>` format unless you are using cookies to send refresh tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "ok": true
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
| `401 Unauthorized`          | Either the user's refresh token is invalid or has expired.                                                             |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

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
- [**GET `/apps/:id/sessions`**](#get-appsidsessions) - Fetch an app's sessions by applying various optional filters.
- [**GET `/apps/:id/sessions/:id`**](#get-appsidsessionsid) - Fetch an app's session replay.
- [**GET `/apps/:id/alertPrefs`**](#get-appsidalertprefs) - Fetch an app's alert preferences for current user.
- [**PATCH `/apps/:id/alertPrefs`**](#patch-appsidalertprefs) - Update an app's alert preferences for current user.
- [**PATCH `/apps/:id/rename`**](#patch-appsidrename) - Modify the name of an app.
- [**GET `/apps/:id/settings`**](#get-appsidsettings) - Fetch an app's settings.
- [**PATCH `/apps/:id/settings`**](#patch-appsidsettings) - Update an app's settings.
- [**POST `/apps/:id/shortFilters`**](#post-appsidshortfilters) - Create a shortcode to represent a combination of various app filters.
- [**GET `/apps/:id/spans/roots/names`**](#get-appsidspansrootsnames) - Fetch an app's root span names list with optional filters.
- [**GET `/apps/:id/spans`**](#get-appsidspans) - Fetch a span's list of instances with optional filters.
- [**GET `/apps/:id/spans/plots/metrics`**](#get-appsidspansplotsmetrics) - Fetch a span's metrics plot with optional filters.
- [**GET `/apps/:id/traces/:traceId`**](#get-appsidtracestraceid) - Fetch a trace.
- [**GET `/apps/:id/bugReports`**](#get-appsidbugreports) - Fetch an app's bug reports with optional filters.
- [**GET `/apps/:id/bugReports/plots/instances`**](#get-appsidbugreportsplotsinstances) - Fetch an app's bug report instances plot with optional filters.
- [**GET `/apps/:id/bugReports/:bugReportId`**](#get-appsidbugreportsbugreportid) - Fetch a bug report.
- [**PATCH `/apps/:id/bugReports/:bugReportId`**](#patch-appsidbugreportsbugreportid) - Update a bug report's status.
- [**GET `/apps/:id/alerts`**](#get-appsidalerts) - Fetch an app's alerts with optional filters.
- [**GET `/apps/:id/sessionTargetingRules`**](#get-appsidsessiontargetingrules) - Fetch an app's session targeting rules.
- [**GET `/apps/:id/sessionTargetingRules/:ruleId`**](#get-appsidsessiontargetingruleruleid) - Fetch a session targeting rule by rule ID.
- [**POST `/apps/:id/sessionTargetingRules/`**](#post-appsidsessiontargetingrules) - Creates a new session targeting rule.
- [**PATCH `/apps/:id/sessionTargetingRules/:ruleId`**](#patch-appsidsessiontargetingrulesruleid) - Updates an existin targeting rule.
- [**GET `/apps/:id/sessionTargetingRules/config`**](#get-appsidsessiontargetingrulesconfig) - Fetch an app's session targeting rules dashboard config.

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

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

  <details>
    <summary>Click to expand</summary>

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
- Pass `crash=1` as query string parameter to only return filters for crashes
- Pass `anr=1` as query string parameter to only return filters for ANRs
- Pass `ud_attr_keys=1` as query string parameter to return user defined attribute keys
- If no query string parameters are passed, the API computes filters from all events

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "countries": [
      "bogon"
    ],
    "device_manufacturers": [
      "Google"
    ],
    "device_names": [
      "emu64a",
      "emu64a16k"
    ],
    "locales": [
      "en-US"
    ],
    "network_generations": [
      "3g",
      "unknown"
    ],
    "network_providers": [
      "T-Mobile",
      "unknown"
    ],
    "network_types": [
      "cellular",
      "no_network",
      "unknown",
      "wifi"
    ],
    "os_versions": [
      {
        "name": "android",
        "version": "35"
      },
      {
        "name": "android",
        "version": "33"
      }
    ],
    "ud_attrs": {
      "key_types": [
        {
          "key": "username",
          "type": "string"
        },
        {
          "key": "paid_user",
          "type": "bool"
        },
        {
          "key": "credit_balance",
          "type": "int64"
        },
        {
          "key": "latitude",
          "type": "float64"
        }
      ],
      "operator_types": {
        "bool": [
          "eq",
          "neq"
        ],
        "float64": [
          "eq",
          "neq",
          "gt",
          "lt",
          "gte",
          "lte"
        ],
        "int64": [
          "eq",
          "neq",
          "gt",
          "lt",
          "gte",
          "lte"
        ],
        "string": [
          "eq",
          "neq",
          "contains",
          "startsWith"
        ]
      }
    },
    "versions": [
      {
        "code": "800",
        "name": "0.8.0-SNAPSHOT.debug"
      },
      {
        "code": "700",
        "name": "0.7.0-SNAPSHOT.debug"
      },
      {
        "code": "1",
        "name": "1.0"
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
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "meta": {
      "next": false,
      "previous": false
    },
    "results": [
      {
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "id": "0a674646a76ebe4aa378b8e1aaa49d61",
            "type": "java.lang.IllegalAccessException",
            "message": "This is a new exception",
            "method_name": "onClick",
            "file_name": "ExceptionDemoActivity",
            "line_number": 0,
            "count": 11,
            "percentage_contribution": 36.67,
            "updated_at": "2025-06-13T14:08:58.228662166Z"
        },
        {
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "id": "b98e7b3ee2144b658ee613ab18a4326f",
            "type": "java.lang.StackOverflowError",
            "message": "stack size 8188KB",
            "method_name": "recursiveFunction",
            "file_name": "ExceptionDemoActivity.kt",
            "line_number": 195,
            "count": 5,
            "percentage_contribution": 16.67,
            "updated_at": "2025-06-13T14:08:58.253760541Z"
        },
        {
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "id": "2ca7a0d943d923ee99af0e94d89ee0bc",
            "type": "java.lang.OutOfMemoryError",
            "message": "Failed to allocate a 104857616 byte allocation with 25165824 free bytes and 88MB until OOM, target footprint 133174272, growth limit 201326592",
            "method_name": "onClick",
            "file_name": "ExceptionDemoActivity",
            "line_number": 0,
            "count": 4,
            "percentage_contribution": 13.33,
            "updated_at": "2025-06-13T14:08:58.084689791Z"
        },
        {
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "id": "f94859bc4b47fbf05b4eec2a300de0a4",
            "type": "sh.measure.sample.CustomException",
            "message": "This is a nested custom exception",
            "method_name": "onClick",
            "file_name": "ExceptionDemoActivity",
            "line_number": 0,
            "count": 4,
            "percentage_contribution": 13.33,
            "updated_at": "2025-06-13T14:08:57.940485305Z"
        },
        {
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "id": "c4ee2ff2e2496be30848cf500300be56",
            "type": "android.app.RemoteServiceException$CrashedByAdbException",
            "message": "shell-induced crash",
            "method_name": "throwRemoteServiceException",
            "file_name": "ActivityThread.java",
            "line_number": 1990,
            "count": 3,
            "percentage_contribution": 10,
            "updated_at": "2025-06-13T14:08:56.040462013Z"
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
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.
- Both `from` and `to` **MUST** be present when specifyng date range.

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.

#### Authorization &amp; Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.

#### Authorization &amp; Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "meta": {
      "next": false,
      "previous": false
    },
    "results": [
      {
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "id": "09ef78940bd258030ebe3937bf1e32a2",
            "type": "sh.measure.android.anr.AnrError",
            "message": "Application Not Responding for at least 5s",
            "method_name": "run",
            "file_name": "CpuUsageCollector",
            "line_number": 0,
            "count": 1,
            "percentage_contribution": 50,
            "updated_at": "2025-06-13T14:08:58.003350625Z"
        },
        {
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "id": "19f5125829c0477f56a6e610cd81b735",
            "type": "sh.measure.android.anr.AnrError",
            "message": "Application Not Responding for at least 5s",
            "method_name": "sleep",
            "file_name": "Thread.java",
            "line_number": -2,
            "count": 1,
            "percentage_contribution": 50,
            "updated_at": "2025-06-13T14:08:56.313369888Z"
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
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.
- Both `from` and `to` **MUST** be present when specifyng date range.

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.

#### Authorization &amp; Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.

#### Authorization &amp; Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

### GET `/apps/:id/sessions`

Fetch an app's sessions by applying various optional filters.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` (_optional_) - ISO8601 timestamp to include sessions after this time.
  - `to` (_optional_) - ISO8601 timestamp to include sessions before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching sessions.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching sessions.
  - `crash` (_optional_) - Boolean true/false to control if only sessions containing at least 1 crash should be fetched.
  - `anr` (_optional_) - Boolean true/false to control if only sessions containing at least 1 ANR should be fetched.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching sessions.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching sessions.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching sessions.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching sessions.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching sessions.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching sessions.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching sessions.
  - `free_text` (_optional_) - A sequence of characters used to filter sessions matching various criteria like user_id, even type, exception message and so on.
  - `offset` (_optional_) - Number of items to skip when paginating. Use with `limit` parameter to control amount of items fetched.
  - `limit` (_optional_) - Number of items to return. Used for pagination. Should be used along with `offset`.
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.
- Pass `limit` and `offset` values to paginate results

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "meta": {
      "next": true,
      "previous": false
    },
    "results": [
      {
        "session_id": "295842e1-7cd9-4ca3-8545-d6a5b36be9a4",
        "app_id": "36e1b948-3a0a-4e71-80f3-625e61d6c832",
        "attribute": {
          "installation_id": "00000000-0000-0000-0000-000000000000",
          "app_version": "0.8.0-SNAPSHOT.debug",
          "app_build": "800",
          "app_unique_id": "",
          "measure_sdk_version": "",
          "platform": "",
          "thread_name": "",
          "user_id": "",
          "device_name": "emu64a16k",
          "device_model": "sdk_gphone16k_arm64",
          "device_manufacturer": "Google",
          "device_type": "",
          "device_is_foldable": false,
          "device_is_physical": false,
          "device_density_dpi": 0,
          "device_width_px": 0,
          "device_height_px": 0,
          "device_density": 0,
          "device_locale": "",
          "os_name": "android",
          "os_version": "35",
          "os_page_size": 0,
          "network_type": "",
          "network_provider": "",
          "network_generation": ""
        },
        "events": null,
        "first_event_time": "2024-10-26T05:52:43.104Z",
        "last_event_time": "2024-10-26T05:53:58.596Z",
        "duration": 75492,
        "matched_free_text": ""
      },
      {
        "session_id": "2cc9ffd2-9f9d-40a7-9f55-d802a460507a",
        "app_id": "36e1b948-3a0a-4e71-80f3-625e61d6c832",
        "attribute": {
          "installation_id": "00000000-0000-0000-0000-000000000000",
          "app_version": "0.8.0-SNAPSHOT.debug",
          "app_build": "800",
          "app_unique_id": "",
          "measure_sdk_version": "",
          "platform": "",
          "thread_name": "",
          "user_id": "",
          "device_name": "emu64a",
          "device_model": "sdk_gphone64_arm64",
          "device_manufacturer": "Google",
          "device_type": "",
          "device_is_foldable": false,
          "device_is_physical": false,
          "device_density_dpi": 0,
          "device_width_px": 0,
          "device_height_px": 0,
          "device_density": 0,
          "device_locale": "",
          "os_name": "android",
          "os_version": "33",
          "os_page_size": 0,
          "network_type": "",
          "network_provider": "",
          "network_generation": ""
        },
        "events": null,
        "first_event_time": "2024-10-02T18:26:58.226Z",
        "last_event_time": "2024-10-02T18:27:09.151Z",
        "duration": 10925,
        "matched_free_text": ""
      },
      {
        "session_id": "1152c238-4583-49b7-93fa-0c73d6a3d5b1",
        "app_id": "36e1b948-3a0a-4e71-80f3-625e61d6c832",
        "attribute": {
          "installation_id": "00000000-0000-0000-0000-000000000000",
          "app_version": "0.8.0-SNAPSHOT.debug",
          "app_build": "800",
          "app_unique_id": "",
          "measure_sdk_version": "",
          "platform": "",
          "thread_name": "",
          "user_id": "",
          "device_name": "emu64a",
          "device_model": "sdk_gphone64_arm64",
          "device_manufacturer": "Google",
          "device_type": "",
          "device_is_foldable": false,
          "device_is_physical": false,
          "device_density_dpi": 0,
          "device_width_px": 0,
          "device_height_px": 0,
          "device_density": 0,
          "device_locale": "",
          "os_name": "android",
          "os_version": "33",
          "os_page_size": 0,
          "network_type": "",
          "network_provider": "",
          "network_generation": ""
        },
        "events": null,
        "first_event_time": "2024-10-02T13:11:45.182Z",
        "last_event_time": "2024-10-02T13:15:14.489Z",
        "duration": 209307,
        "matched_free_text": ""
      },
      {
        "session_id": "6d132488-9f91-4f4e-9869-e80fc5f4a03c",
        "app_id": "36e1b948-3a0a-4e71-80f3-625e61d6c832",
        "attribute": {
          "installation_id": "00000000-0000-0000-0000-000000000000",
          "app_version": "0.8.0-SNAPSHOT.debug",
          "app_build": "800",
          "app_unique_id": "",
          "measure_sdk_version": "",
          "platform": "",
          "thread_name": "",
          "user_id": "",
          "device_name": "emu64a",
          "device_model": "sdk_gphone64_arm64",
          "device_manufacturer": "Google",
          "device_type": "",
          "device_is_foldable": false,
          "device_is_physical": false,
          "device_density_dpi": 0,
          "device_width_px": 0,
          "device_height_px": 0,
          "device_density": 0,
          "device_locale": "",
          "os_name": "android",
          "os_version": "33",
          "os_page_size": 0,
          "network_type": "",
          "network_provider": "",
          "network_generation": ""
        },
        "events": null,
        "first_event_time": "2024-10-02T13:10:28.454Z",
        "last_event_time": "2024-10-02T13:11:08.89Z",
        "duration": 40436,
        "matched_free_text": ""
      },
      {
        "session_id": "5e6e1064-9eed-499f-b552-c2dc993b4792",
        "app_id": "36e1b948-3a0a-4e71-80f3-625e61d6c832",
        "attribute": {
          "installation_id": "00000000-0000-0000-0000-000000000000",
          "app_version": "0.7.0-SNAPSHOT.debug",
          "app_build": "700",
          "app_unique_id": "",
          "measure_sdk_version": "",
          "platform": "",
          "thread_name": "",
          "user_id": "",
          "device_name": "emu64a16k",
          "device_model": "sdk_gphone16k_arm64",
          "device_manufacturer": "Google",
          "device_type": "",
          "device_is_foldable": false,
          "device_is_physical": false,
          "device_density_dpi": 0,
          "device_width_px": 0,
          "device_height_px": 0,
          "device_density": 0,
          "device_locale": "",
          "os_name": "android",
          "os_version": "35",
          "os_page_size": 0,
          "network_type": "",
          "network_provider": "",
          "network_generation": ""
        },
        "events": null,
        "first_event_time": "2024-09-23T10:07:08.236Z",
        "last_event_time": "2024-09-23T10:07:13.063Z",
        "duration": 4827,
        "matched_free_text": ""
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

### GET `/apps/:id/sessions/:id`

Fetch an app's session replay.

#### Usage Notes

- App's UUID must be passed in the URI
- Sessions's UUID must be passed in the URI

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

<details>
  <summary>Click to expand</summary>

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
      "network_generation": "unknown"
    },
    "cpu_usage": [
      {
        "timestamp": "2024-05-03T23:34:17.591Z",
        "value": 6.999999999999999
      },
      {
        "timestamp": "2024-05-03T23:34:20.567Z",
        "value": 24
      },
      {
        "timestamp": "2024-05-03T23:34:23.567Z",
        "value": 28.999999999999996
      },
      {
        "timestamp": "2024-05-03T23:34:26.569Z",
        "value": 30.333333333333336
      }
    ],
    "duration": 22084,
    "memory_usage": [
      {
        "java_max_heap": 196608,
        "java_total_heap": 196608,
        "java_free_heap": 183734,
        "total_pss": 63702,
        "rss": 171692,
        "native_total_heap": 21872,
        "native_free_heap": 1299,
        "interval": 2000,
        "timestamp": "2024-05-03T23:34:17.607Z"
      },
      {
        "java_max_heap": 196608,
        "java_total_heap": 49152,
        "java_free_heap": 25884,
        "total_pss": 96896,
        "rss": 187708,
        "native_total_heap": 24060,
        "native_free_heap": 1171,
        "interval": 2000,
        "timestamp": "2024-05-03T23:34:19.566Z"
      },
      {
        "java_max_heap": 196608,
        "java_total_heap": 49152,
        "java_free_heap": 25063,
        "total_pss": 94875,
        "rss": 185312,
        "native_total_heap": 24828,
        "native_free_heap": 1452,
        "interval": 2000,
        "timestamp": "2024-05-03T23:34:21.565Z"
      },
      {
        "java_max_heap": 196608,
        "java_total_heap": 49152,
        "java_free_heap": 24975,
        "total_pss": 95547,
        "rss": 185920,
        "native_total_heap": 24828,
        "native_free_heap": 1452,
        "interval": 2000,
        "timestamp": "2024-05-03T23:34:23.571Z"
      },
      {
        "java_max_heap": 196608,
        "java_total_heap": 49152,
        "java_free_heap": 24923,
        "total_pss": 95587,
        "rss": 185920,
        "native_total_heap": 24828,
        "native_free_heap": 1436,
        "interval": 2000,
        "timestamp": "2024-05-03T23:34:25.568Z"
      },
      {
        "java_max_heap": 196608,
        "java_total_heap": 24300,
        "java_free_heap": 0,
        "total_pss": 99105,
        "rss": 191340,
        "native_total_heap": 26620,
        "native_free_heap": 2879,
        "interval": 2000,
        "timestamp": "2024-05-03T23:34:27.565Z"
      }
    ],
    "session_id": "58e94ae9-a084-479f-9049-2c5135f6090f",
    "threads": {
      "OkHttp https://httpbin.org/...": [
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "OkHttp https://httpbin.org/...",
          "user_triggered": false,
          "url": "https://httpbin.org/",
          "method": "get",
          "status_code": 200,
          "start_time": 5128127,
          "end_time": 5129475,
          "request_body": "",
          "response_body": "",
          "failure_reason": "",
          "failure_description": "",
          "request_headers": {
            "accept-encoding": "gzip",
            "connection": "Keep-Alive",
            "host": "httpbin.org",
            "user-agent": "okhttp/4.12.0"
          },
          "response_headers": {
            "access-control-allow-credentials": "true",
            "access-control-allow-origin": "*",
            "content-length": "9593",
            "content-type": "text/html; charset=utf-8",
            "date": "Fri, 03 May 2024 23:34:20 GMT",
            "server": "gunicorn/19.9.0"
          },
          "client": "okhttp",
          "duration": 1348,
          "timestamp": "2024-05-03T23:34:19.979Z"
        }
      ],
      "Thread-2": [
        {
          "event_type": "anr",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "title": "sh.measure.android.anr.AnrError@ExceptionDemoActivity.kt:66",
          "thread_name": "Thread-2",
          "stacktrace": "sh.measure.android.anr.AnrError: Application Not Responding for at least 5000 ms.\n\tat sh.measure.sample.ExceptionDemoActivity.deadLock$lambda$10(ExceptionDemoActivity.kt:66)\n\tat sh.measure.sample.ExceptionDemoActivity.$r8$lambda$G4MY09CRhRk9ettfD7HPDD_b1n4\n\tat sh.measure.sample.ExceptionDemoActivity$$ExternalSyntheticLambda0.run(R8$$SyntheticClass)\n\tat android.os.Handler.handleCallback(Handler.java:942)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loopOnce(Looper.java:201)\n\tat android.os.Looper.loop(Looper.java:288)\n\tat android.app.ActivityThread.main(ActivityThread.java:7872)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)",
          "foreground": true,
          "timestamp": "2024-05-03T23:34:27.578Z",
          "attachments": [
            {
              "id": "63fb0950-faff-4028-bf3d-354559e4e540",
              "name": "screenshot.png",
              "type": "screenshot",
              "key": "63fb0950-faff-4028-bf3d-354559e4e540.png",
              "location": "http://localhost:9111/msr-attachments-sandbox/63fb0950-faff-4028-bf3d-354559e4e540.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minio%2F20240626%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240626T194224Z&X-Amz-Expires=172800&X-Amz-SignedHeaders=host&X-Amz-Signature=bd6825a4a47dd4df3742492239d05bbee8881f59a27a314f7e7bf7ea5dc139e9"
            }
          ]
        }
      ],
      "main": [
        {
          "event_type": "lifecycle_activity",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "type": "created",
          "class_name": "sh.measure.sample.ExceptionDemoActivity",
          "intent": "",
          "saved_instance_state": false,
          "timestamp": "2024-05-03T23:34:17.647Z"
        },
        {
          "event_type": "lifecycle_app",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "type": "foreground",
          "timestamp": "2024-05-03T23:34:17.74Z"
        },
        {
          "event_type": "lifecycle_activity",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "type": "resumed",
          "class_name": "sh.measure.sample.ExceptionDemoActivity",
          "intent": "",
          "saved_instance_state": false,
          "timestamp": "2024-05-03T23:34:17.744Z"
        },
        {
          "event_type": "cold_launch",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "duration": 698,
          "timestamp": "2024-05-03T23:34:17.825Z"
        },
        {
          "event_type": "gesture_click",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "target": "com.google.android.material.button.MaterialButton",
          "target_id": "btn_okhttp",
          "width": 262,
          "height": 132,
          "x": 546.95435,
          "y": 1460.94,
          "timestamp": "2024-05-03T23:34:18.586Z"
        },
        {
          "event_type": "lifecycle_activity",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "type": "paused",
          "class_name": "sh.measure.sample.ExceptionDemoActivity",
          "intent": "",
          "saved_instance_state": false,
          "timestamp": "2024-05-03T23:34:18.603Z"
        },
        {
          "event_type": "lifecycle_activity",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "type": "created",
          "class_name": "sh.measure.sample.OkHttpActivity",
          "intent": "",
          "saved_instance_state": false,
          "timestamp": "2024-05-03T23:34:18.615Z"
        },
        {
          "event_type": "lifecycle_activity",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "type": "resumed",
          "class_name": "sh.measure.sample.OkHttpActivity",
          "intent": "",
          "saved_instance_state": false,
          "timestamp": "2024-05-03T23:34:18.637Z"
        },
        {
          "event_type": "lifecycle_activity",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "type": "paused",
          "class_name": "sh.measure.sample.OkHttpActivity",
          "intent": "",
          "saved_instance_state": false,
          "timestamp": "2024-05-03T23:34:20.04Z"
        },
        {
          "event_type": "lifecycle_activity",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "type": "resumed",
          "class_name": "sh.measure.sample.ExceptionDemoActivity",
          "intent": "",
          "saved_instance_state": false,
          "timestamp": "2024-05-03T23:34:20.048Z"
        },
        {
          "event_type": "lifecycle_activity",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "type": "destroyed",
          "class_name": "sh.measure.sample.OkHttpActivity",
          "intent": "",
          "saved_instance_state": false,
          "timestamp": "2024-05-03T23:34:20.606Z"
        },
        {
          "event_type": "gesture_click",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "main",
          "target": "com.google.android.material.button.MaterialButton",
          "target_id": "btn_deadlock",
          "width": 311,
          "height": 132,
          "x": 549.9536,
          "y": 1324.8999,
          "timestamp": "2024-05-03T23:34:20.98Z"
        }
      ],
      "msr-bg": [
        {
          "event_type": "app_exit",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-bg",
          "reason": "ANR",
          "importance": "FOREGROUND",
          "trace": "DALVIK THREADS (37):\n\"Signal Catcher\" daemon prio=10 tid=2 Runnable\n  native: #00 pc 000000000053a6e0  /apex/com.android.art/lib64/libart.so (art::DumpNativeStack(std::__1::basic_ostream<char, std::__1::char_traits<char> >&, int, BacktraceMap*, char const*, art::ArtMethod*, void*, bool)+128) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #01 pc 00000000006f0e84  /apex/com.android.art/lib64/libart.so (art::Thread::DumpStack(std::__1::basic_ostream<char, std::__1::char_traits<char> >&, bool, BacktraceMap*, bool) const+236) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #02 pc 00000000006fe710  /apex/com.android.art/lib64/libart.so (art::DumpCheckpoint::Run(art::Thread*)+208) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #03 pc 0000000000364248  /apex/com.android.art/lib64/libart.so (art::ThreadList::RunCheckpoint(art::Closure*, art::Closure*)+440) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #04 pc 00000000006fceb0  /apex/com.android.art/lib64/libart.so (art::ThreadList::Dump(std::__1::basic_ostream<char, std::__1::char_traits<char> >&, bool)+280) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #05 pc 00000000006fc8a4  /apex/com.android.art/lib64/libart.so (art::ThreadList::DumpForSigQuit(std::__1::basic_ostream<char, std::__1::char_traits<char> >&)+292) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #06 pc 00000000006d5974  /apex/com.android.art/lib64/libart.so (art::Runtime::DumpForSigQuit(std::__1::basic_ostream<char, std::__1::char_traits<char> >&)+184) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #07 pc 00000000006e1a20  /apex/com.android.art/lib64/libart.so (art::SignalCatcher::HandleSigQuit()+468) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #08 pc 0000000000574230  /apex/com.android.art/lib64/libart.so (art::SignalCatcher::Run(void*)+264) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #09 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #10 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"main\" prio=5 tid=1 Blocked\n  at sh.measure.sample.ExceptionDemoActivity.deadLock$lambda$10(ExceptionDemoActivity.kt:66)\n  - waiting to lock <0x0b2cc044> (a java.lang.Object) held by thread 38\n  at sh.measure.sample.ExceptionDemoActivity.$r8$lambda$G4MY09CRhRk9ettfD7HPDD_b1n4(unavailable:0)\n  at sh.measure.sample.ExceptionDemoActivity$$ExternalSyntheticLambda0.run(D8$$SyntheticClass:0)\n  at android.os.Handler.handleCallback(Handler.java:942)\n  at android.os.Handler.dispatchMessage(Handler.java:99)\n  at android.os.Looper.loopOnce(Looper.java:201)\n  at android.os.Looper.loop(Looper.java:288)\n  at android.app.ActivityThread.main(ActivityThread.java:7872)\n  at java.lang.reflect.Method.invoke(Native method)\n  at com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)\n  at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)\n\n\"ADB-JDWP Connection Control Thread\" daemon prio=0 tid=4 WaitingInMainDebuggerLoop\n  native: #00 pc 00000000000a34b8  /apex/com.android.runtime/lib64/bionic/libc.so (__ppoll+8) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 000000000005dc1c  /apex/com.android.runtime/lib64/bionic/libc.so (poll+92) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #02 pc 00000000000099e4  /apex/com.android.art/lib64/libadbconnection.so (adbconnection::AdbConnectionState::RunPollLoop(art::Thread*)+724) (BuildId: 3952e992b55a158a16b3d569cf8894e7)\n  native: #03 pc 00000000000080ac  /apex/com.android.art/lib64/libadbconnection.so (adbconnection::CallbackFunction(void*)+1320) (BuildId: 3952e992b55a158a16b3d569cf8894e7)\n  native: #04 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #05 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"perfetto_hprof_listener\" prio=10 tid=5 Native (still starting up)\n  native: #00 pc 00000000000a20f4  /apex/com.android.runtime/lib64/bionic/libc.so (read+4) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 000000000001d840  /apex/com.android.art/lib64/libperfetto_hprof.so (void* std::__1::__thread_proxy<std::__1::tuple<std::__1::unique_ptr<std::__1::__thread_struct, std::__1::default_delete<std::__1::__thread_struct> >, ArtPlugin_Initialize::$_34> >(void*)+260) (BuildId: 525cc92a7dc49130157aeb74f6870364)\n  native: #02 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #03 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"Jit thread pool worker thread 0\" daemon prio=5 tid=6 Native\n  native: #00 pc 000000000004df5c  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+28) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 000000000047cc80  /apex/com.android.art/lib64/libart.so (art::ConditionVariable::WaitHoldingLocks(art::Thread*)+140) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #02 pc 000000000047cb18  /apex/com.android.art/lib64/libart.so (art::ThreadPool::GetTask(art::Thread*)+120) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #03 pc 00000000006199e4  /apex/com.android.art/lib64/libart.so (art::ThreadPoolWorker::Run()+136) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #04 pc 00000000006198c4  /apex/com.android.art/lib64/libart.so (art::ThreadPoolWorker::Callback(void*)+160) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #05 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #06 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"HeapTaskDaemon\" daemon prio=5 tid=7 WaitingForTaskProcessor\n  native: #00 pc 000000000004df60  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+32) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 000000000048771c  /apex/com.android.art/lib64/libart.so (art::ConditionVariable::TimedWait(art::Thread*, long, int)+252) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #02 pc 000000000046cf20  /apex/com.android.art/lib64/libart.so (art::gc::TaskProcessor::GetTask(art::Thread*)+196) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #03 pc 000000000046ce10  /apex/com.android.art/lib64/libart.so (art::gc::TaskProcessor::RunAllTasks(art::Thread*)+32) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  at dalvik.system.VMRuntime.runHeapTasks(Native method)\n  at java.lang.Daemons$HeapTaskDaemon.runInternal(Daemons.java:609)\n  at java.lang.Daemons$Daemon.run(Daemons.java:140)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"ReferenceQueueDaemon\" daemon prio=5 tid=8 Waiting\n  at java.lang.Object.wait(Native method)\n  - waiting on <0x0d3ac52d> (a java.lang.Class<java.lang.ref.ReferenceQueue>)\n  at java.lang.Object.wait(Object.java:442)\n  at java.lang.Object.wait(Object.java:568)\n  at java.lang.Daemons$ReferenceQueueDaemon.runInternal(Daemons.java:232)\n  - locked <0x0d3ac52d> (a java.lang.Class<java.lang.ref.ReferenceQueue>)\n  at java.lang.Daemons$Daemon.run(Daemons.java:140)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"FinalizerDaemon\" daemon prio=5 tid=9 Waiting\n  at java.lang.Object.wait(Native method)\n  - waiting on <0x07e7da62> (a java.lang.Object)\n  at java.lang.Object.wait(Object.java:442)\n  at java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:203)\n  - locked <0x07e7da62> (a java.lang.Object)\n  at java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:224)\n  at java.lang.Daemons$FinalizerDaemon.runInternal(Daemons.java:300)\n  at java.lang.Daemons$Daemon.run(Daemons.java:140)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"FinalizerWatchdogDaemon\" daemon prio=5 tid=10 Waiting\n  at java.lang.Object.wait(Native method)\n  - waiting on <0x0c0e07f3> (a java.lang.Daemons$FinalizerWatchdogDaemon)\n  at java.lang.Object.wait(Object.java:442)\n  at java.lang.Object.wait(Object.java:568)\n  at java.lang.Daemons$FinalizerWatchdogDaemon.sleepUntilNeeded(Daemons.java:385)\n  - locked <0x0c0e07f3> (a java.lang.Daemons$FinalizerWatchdogDaemon)\n  at java.lang.Daemons$FinalizerWatchdogDaemon.runInternal(Daemons.java:365)\n  at java.lang.Daemons$Daemon.run(Daemons.java:140)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"binder:10281_1\" prio=5 tid=11 Native\n  native: #00 pc 00000000000a23d8  /apex/com.android.runtime/lib64/bionic/libc.so (__ioctl+8) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 000000000005b50c  /apex/com.android.runtime/lib64/bionic/libc.so (ioctl+156) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #02 pc 0000000000094690  /system/lib64/libbinder.so (android::IPCThreadState::joinThreadPool(bool)+316) (BuildId: ee18e52b95e38eaab55a9a48518c8c3b)\n  native: #03 pc 0000000000094540  /system/lib64/libbinder.so (android::PoolThread::threadLoop()+24) (BuildId: ee18e52b95e38eaab55a9a48518c8c3b)\n  native: #04 pc 00000000000148e8  /system/lib64/libutils.so (android::Thread::_threadLoop(void*)+528) (BuildId: 5a0d720732600c94ad8354a1188e9f52)\n  native: #05 pc 00000000000c8918  /system/lib64/libandroid_runtime.so (android::AndroidRuntime::javaThreadShell(void*)+140) (BuildId: a31474ac581b716d4588f8c97eb06009)\n  native: #06 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #07 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"binder:10281_2\" prio=5 tid=12 Native\n  native: #00 pc 00000000000a23d8  /apex/com.android.runtime/lib64/bionic/libc.so (__ioctl+8) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 000000000005b50c  /apex/com.android.runtime/lib64/bionic/libc.so (ioctl+156) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #02 pc 0000000000094690  /system/lib64/libbinder.so (android::IPCThreadState::joinThreadPool(bool)+316) (BuildId: ee18e52b95e38eaab55a9a48518c8c3b)\n  native: #03 pc 0000000000094540  /system/lib64/libbinder.so (android::PoolThread::threadLoop()+24) (BuildId: ee18e52b95e38eaab55a9a48518c8c3b)\n  native: #04 pc 00000000000148e8  /system/lib64/libutils.so (android::Thread::_threadLoop(void*)+528) (BuildId: 5a0d720732600c94ad8354a1188e9f52)\n  native: #05 pc 00000000000c8918  /system/lib64/libandroid_runtime.so (android::AndroidRuntime::javaThreadShell(void*)+140) (BuildId: a31474ac581b716d4588f8c97eb06009)\n  native: #06 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #07 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"binder:10281_3\" prio=5 tid=13 Native\n  native: #00 pc 00000000000a23d8  /apex/com.android.runtime/lib64/bionic/libc.so (__ioctl+8) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 000000000005b50c  /apex/com.android.runtime/lib64/bionic/libc.so (ioctl+156) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #02 pc 0000000000094690  /system/lib64/libbinder.so (android::IPCThreadState::joinThreadPool(bool)+316) (BuildId: ee18e52b95e38eaab55a9a48518c8c3b)\n  native: #03 pc 0000000000094540  /system/lib64/libbinder.so (android::PoolThread::threadLoop()+24) (BuildId: ee18e52b95e38eaab55a9a48518c8c3b)\n  native: #04 pc 00000000000148e8  /system/lib64/libutils.so (android::Thread::_threadLoop(void*)+528) (BuildId: 5a0d720732600c94ad8354a1188e9f52)\n  native: #05 pc 00000000000c8918  /system/lib64/libandroid_runtime.so (android::AndroidRuntime::javaThreadShell(void*)+140) (BuildId: a31474ac581b716d4588f8c97eb06009)\n  native: #06 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #07 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"binder:10281_4\" prio=5 tid=14 Native\n  native: #00 pc 00000000000a23d8  /apex/com.android.runtime/lib64/bionic/libc.so (__ioctl+8) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 000000000005b50c  /apex/com.android.runtime/lib64/bionic/libc.so (ioctl+156) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #02 pc 0000000000094690  /system/lib64/libbinder.so (android::IPCThreadState::joinThreadPool(bool)+316) (BuildId: ee18e52b95e38eaab55a9a48518c8c3b)\n  native: #03 pc 0000000000094540  /system/lib64/libbinder.so (android::PoolThread::threadLoop()+24) (BuildId: ee18e52b95e38eaab55a9a48518c8c3b)\n  native: #04 pc 00000000000148e8  /system/lib64/libutils.so (android::Thread::_threadLoop(void*)+528) (BuildId: 5a0d720732600c94ad8354a1188e9f52)\n  native: #05 pc 00000000000c8918  /system/lib64/libandroid_runtime.so (android::AndroidRuntime::javaThreadShell(void*)+140) (BuildId: a31474ac581b716d4588f8c97eb06009)\n  native: #06 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #07 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"Profile Saver\" daemon prio=5 tid=15 Native\n  native: #00 pc 000000000004df60  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+32) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 000000000048771c  /apex/com.android.art/lib64/libart.so (art::ConditionVariable::TimedWait(art::Thread*, long, int)+252) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #02 pc 000000000054380c  /apex/com.android.art/lib64/libart.so (art::ProfileSaver::Run()+524) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #03 pc 0000000000538fc0  /apex/com.android.art/lib64/libart.so (art::ProfileSaver::RunProfileSaverThread(void*)+148) (BuildId: e24a1818231cfb1649cb83a5d2869598)\n  native: #04 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #05 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"msr-cmu\" prio=5 tid=16 TimedWaiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)\n  at java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)\n  at java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)\n  at java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"Thread-2\" prio=5 tid=17 Sleeping\n  at java.lang.Thread.sleep(Native method)\n  - sleeping on <0x01579cb0> (a java.lang.Object)\n  at java.lang.Thread.sleep(Thread.java:450)\n  - locked <0x01579cb0> (a java.lang.Object)\n  at java.lang.Thread.sleep(Thread.java:355)\n  at sh.measure.android.anr.ANRWatchDog.run(ANRWatchDog.kt:70)\n\n\"ConnectivityThread\" prio=5 tid=18 Native\n  native: #00 pc 00000000000a33b8  /apex/com.android.runtime/lib64/bionic/libc.so (__epoll_pwait+8) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 0000000000010dfc  /system/lib64/libutils.so (android::Looper::pollOnce(int, int*, int*, void**)+176) (BuildId: 5a0d720732600c94ad8354a1188e9f52)\n  native: #02 pc 000000000015a56c  /system/lib64/libandroid_runtime.so (android::android_os_MessageQueue_nativePollOnce(_JNIEnv*, _jobject*, long, int)+44) (BuildId: a31474ac581b716d4588f8c97eb06009)\n  at android.os.MessageQueue.nativePollOnce(Native method)\n  at android.os.MessageQueue.next(MessageQueue.java:335)\n  at android.os.Looper.loopOnce(Looper.java:161)\n  at android.os.Looper.loop(Looper.java:288)\n  at android.os.HandlerThread.run(HandlerThread.java:67)\n\n\"msr-ep\" prio=5 tid=19 Waiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)\n  at java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)\n  at java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1176)\n  at java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"LeakCanary-Heap-Dump\" prio=5 tid=20 Native\n  native: #00 pc 00000000000a33b8  /apex/com.android.runtime/lib64/bionic/libc.so (__epoll_pwait+8) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 0000000000010dfc  /system/lib64/libutils.so (android::Looper::pollOnce(int, int*, int*, void**)+176) (BuildId: 5a0d720732600c94ad8354a1188e9f52)\n  native: #02 pc 000000000015a56c  /system/lib64/libandroid_runtime.so (android::android_os_MessageQueue_nativePollOnce(_JNIEnv*, _jobject*, long, int)+44) (BuildId: a31474ac581b716d4588f8c97eb06009)\n  at android.os.MessageQueue.nativePollOnce(Native method)\n  at android.os.MessageQueue.next(MessageQueue.java:335)\n  at android.os.Looper.loopOnce(Looper.java:161)\n  at android.os.Looper.loop(Looper.java:288)\n  at android.os.HandlerThread.run(HandlerThread.java:67)\n\n\"RenderThread\" daemon prio=7 tid=21 Native\n  native: #00 pc 00000000000a33b8  /apex/com.android.runtime/lib64/bionic/libc.so (__epoll_pwait+8) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 0000000000010dfc  /system/lib64/libutils.so (android::Looper::pollOnce(int, int*, int*, void**)+176) (BuildId: 5a0d720732600c94ad8354a1188e9f52)\n  native: #02 pc 000000000057c4c0  /system/lib64/libhwui.so (android::uirenderer::renderthread::RenderThread::threadLoop()+220) (BuildId: 5e787210ce0f171dbee073e4a14a376c)\n  native: #03 pc 00000000000148e8  /system/lib64/libutils.so (android::Thread::_threadLoop(void*)+528) (BuildId: 5a0d720732600c94ad8354a1188e9f52)\n  native: #04 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #05 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"msr-bg\" prio=5 tid=22 Waiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)\n  at java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)\n  at java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1176)\n  at java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"msr-eh\" prio=5 tid=23 TimedWaiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)\n  at java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:2123)\n  at java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1188)\n  at java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"msr-ee\" prio=5 tid=24 Waiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)\n  at java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2081)\n  at java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1176)\n  at java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:905)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1063)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"hwuiTask1\" daemon prio=6 tid=25 Native\n  native: #00 pc 000000000004df5c  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+28) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 0000000000052664  /apex/com.android.runtime/lib64/bionic/libc.so (__futex_wait_ex(void volatile*, bool, int, bool, timespec const*)+144) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #02 pc 00000000000b56cc  /apex/com.android.runtime/lib64/bionic/libc.so (pthread_cond_wait+76) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #03 pc 00000000000699e0  /system/lib64/libc++.so (std::__1::condition_variable::wait(std::__1::unique_lock<std::__1::mutex>&)+20) (BuildId: 6ae0290e5bfb8abb216bde2a4ee48d9e)\n  native: #04 pc 0000000000250af8  /system/lib64/libhwui.so (android::uirenderer::CommonPool::workerLoop()+96) (BuildId: 5e787210ce0f171dbee073e4a14a376c)\n  native: #05 pc 0000000000250d5c  /system/lib64/libhwui.so (android::uirenderer::CommonPool::CommonPool()::$_0::operator()() const (.__uniq.99815402873434996937524029735804459536)+188) (BuildId: 5e787210ce0f171dbee073e4a14a376c)\n  native: #06 pc 0000000000250c9c  /system/lib64/libhwui.so (void* std::__1::__thread_proxy<std::__1::tuple<std::__1::unique_ptr<std::__1::__thread_struct, std::__1::default_delete<std::__1::__thread_struct> >, android::uirenderer::CommonPool::CommonPool()::$_0> >(void*) (.__uniq.99815402873434996937524029735804459536)+40) (BuildId: 5e787210ce0f171dbee073e4a14a376c)\n  native: #07 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #08 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"hwuiTask0\" daemon prio=6 tid=26 Native\n  native: #00 pc 000000000004df5c  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+28) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 0000000000052664  /apex/com.android.runtime/lib64/bionic/libc.so (__futex_wait_ex(void volatile*, bool, int, bool, timespec const*)+144) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #02 pc 00000000000b56cc  /apex/com.android.runtime/lib64/bionic/libc.so (pthread_cond_wait+76) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #03 pc 00000000000699e0  /system/lib64/libc++.so (std::__1::condition_variable::wait(std::__1::unique_lock<std::__1::mutex>&)+20) (BuildId: 6ae0290e5bfb8abb216bde2a4ee48d9e)\n  native: #04 pc 0000000000250af8  /system/lib64/libhwui.so (android::uirenderer::CommonPool::workerLoop()+96) (BuildId: 5e787210ce0f171dbee073e4a14a376c)\n  native: #05 pc 0000000000250d5c  /system/lib64/libhwui.so (android::uirenderer::CommonPool::CommonPool()::$_0::operator()() const (.__uniq.99815402873434996937524029735804459536)+188) (BuildId: 5e787210ce0f171dbee073e4a14a376c)\n  native: #06 pc 0000000000250c9c  /system/lib64/libhwui.so (void* std::__1::__thread_proxy<std::__1::tuple<std::__1::unique_ptr<std::__1::__thread_struct, std::__1::default_delete<std::__1::__thread_struct> >, android::uirenderer::CommonPool::CommonPool()::$_0> >(void*) (.__uniq.99815402873434996937524029735804459536)+40) (BuildId: 5e787210ce0f171dbee073e4a14a376c)\n  native: #07 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #08 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  (no managed stack frames)\n\n\"Okio Watchdog\" daemon prio=5 tid=27 TimedWaiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)\n  at java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2211)\n  at okio.AsyncTimeout$Companion.awaitTimeout(AsyncTimeout.kt:370)\n  at okio.AsyncTimeout$Watchdog.run(AsyncTimeout.kt:211)\n\n\"OkHttp Dispatcher\" prio=5 tid=28 TimedWaiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)\n  at java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)\n  at java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)\n  at java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"queued-work-looper\" prio=5 tid=29 Native\n  native: #00 pc 00000000000a33b8  /apex/com.android.runtime/lib64/bionic/libc.so (__epoll_pwait+8) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 0000000000010dfc  /system/lib64/libutils.so (android::Looper::pollOnce(int, int*, int*, void**)+176) (BuildId: 5a0d720732600c94ad8354a1188e9f52)\n  native: #02 pc 000000000015a56c  /system/lib64/libandroid_runtime.so (android::android_os_MessageQueue_nativePollOnce(_JNIEnv*, _jobject*, long, int)+44) (BuildId: a31474ac581b716d4588f8c97eb06009)\n  at android.os.MessageQueue.nativePollOnce(Native method)\n  at android.os.MessageQueue.next(MessageQueue.java:335)\n  at android.os.Looper.loopOnce(Looper.java:161)\n  at android.os.Looper.loop(Looper.java:288)\n  at android.os.HandlerThread.run(HandlerThread.java:67)\n\n\"OkHttp httpbin.org\" daemon prio=5 tid=30 Native\n  native: #00 pc 00000000000a2f54  /apex/com.android.runtime/lib64/bionic/libc.so (recvfrom+4) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 00000000000298c8  /apex/com.android.art/lib64/libopenjdk.so (NET_Read+80) (BuildId: df8df6b1c275e887f918729a4f22136c)\n  native: #02 pc 000000000002a440  /apex/com.android.art/lib64/libopenjdk.so (SocketInputStream_socketRead0+216) (BuildId: df8df6b1c275e887f918729a4f22136c)\n  at java.net.SocketInputStream.socketRead0(Native method)\n  at java.net.SocketInputStream.socketRead(SocketInputStream.java:118)\n  at java.net.SocketInputStream.read(SocketInputStream.java:173)\n  at java.net.SocketInputStream.read(SocketInputStream.java:143)\n  at com.android.org.conscrypt.ConscryptEngineSocket$SSLInputStream.readFromSocket(ConscryptEngineSocket.java:945)\n  at com.android.org.conscrypt.ConscryptEngineSocket$SSLInputStream.processDataFromSocket(ConscryptEngineSocket.java:909)\n  at com.android.org.conscrypt.ConscryptEngineSocket$SSLInputStream.readUntilDataAvailable(ConscryptEngineSocket.java:824)\n  at com.android.org.conscrypt.ConscryptEngineSocket$SSLInputStream.read(ConscryptEngineSocket.java:797)\n  - locked <0x042b8729> (a java.lang.Object)\n  at okio.InputStreamSource.read(JvmOkio.kt:93)\n  at okio.AsyncTimeout$source$1.read(AsyncTimeout.kt:153)\n  at okio.RealBufferedSource.request(RealBufferedSource.kt:209)\n  at okio.RealBufferedSource.require(RealBufferedSource.kt:202)\n  at okhttp3.internal.http2.Http2Reader.nextFrame(Http2Reader.kt:89)\n  at okhttp3.internal.http2.Http2Connection$ReaderRunnable.invoke(Http2Connection.kt:618)\n  at okhttp3.internal.http2.Http2Connection$ReaderRunnable.invoke(Http2Connection.kt:609)\n  at okhttp3.internal.concurrent.TaskQueue$execute$1.runOnce(TaskQueue.kt:98)\n  at okhttp3.internal.concurrent.TaskRunner.runTask(TaskRunner.kt:116)\n  at okhttp3.internal.concurrent.TaskRunner.access$runTask(TaskRunner.kt:42)\n  at okhttp3.internal.concurrent.TaskRunner$runnable$1.run(TaskRunner.kt:65)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1137)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"OkHttp TaskRunner\" daemon prio=5 tid=31 TimedWaiting\n  at java.lang.Object.wait(Native method)\n  - waiting on <0x0c6d3aae> (a okhttp3.internal.concurrent.TaskRunner)\n  at okhttp3.internal.concurrent.TaskRunner$RealBackend.coordinatorWait(TaskRunner.kt:294)\n  at okhttp3.internal.concurrent.TaskRunner.awaitTaskToRun(TaskRunner.kt:218)\n  at okhttp3.internal.concurrent.TaskRunner$runnable$1.run(TaskRunner.kt:59)\n  - locked <0x0c6d3aae> (a okhttp3.internal.concurrent.TaskRunner)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1137)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"OkHttp TaskRunner\" daemon prio=5 tid=32 TimedWaiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)\n  at java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)\n  at java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)\n  at java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"OkHttp TaskRunner\" daemon prio=5 tid=33 TimedWaiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)\n  at java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)\n  at java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)\n  at java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"OkHttp TaskRunner\" daemon prio=5 tid=34 TimedWaiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)\n  at java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)\n  at java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)\n  at java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"OkHttp TaskRunner\" daemon prio=5 tid=35 TimedWaiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)\n  at java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)\n  at java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)\n  at java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"OkHttp TaskRunner\" daemon prio=5 tid=36 TimedWaiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)\n  at java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)\n  at java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)\n  at java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"OkHttp TaskRunner\" daemon prio=5 tid=37 TimedWaiting\n  at jdk.internal.misc.Unsafe.park(Native method)\n  - waiting on an unknown object\n  at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:234)\n  at java.util.concurrent.SynchronousQueue$TransferStack.awaitFulfill(SynchronousQueue.java:463)\n  at java.util.concurrent.SynchronousQueue$TransferStack.transfer(SynchronousQueue.java:361)\n  at java.util.concurrent.SynchronousQueue.poll(SynchronousQueue.java:939)\n  at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1062)\n  at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1123)\n  at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:637)\n  at java.lang.Thread.run(Thread.java:1012)\n\n\"APP: Locker\" prio=5 tid=38 Sleeping\n  at java.lang.Thread.sleep(Native method)\n  - sleeping on <0x02f7304f> (a java.lang.Object)\n  at java.lang.Thread.sleep(Thread.java:450)\n  - locked <0x02f7304f> (a java.lang.Object)\n  at java.lang.Thread.sleep(Thread.java:355)\n  at sh.measure.sample.ExceptionDemoActivity.sleep(ExceptionDemoActivity.kt:86)\n  at sh.measure.sample.ExceptionDemoActivity.access$sleep(ExceptionDemoActivity.kt:12)\n  at sh.measure.sample.ExceptionDemoActivity$LockerThread.run(ExceptionDemoActivity.kt:80)\n  - locked <0x0b2cc044> (a java.lang.Object)\n\n\"binder:10281_2\" prio=5 (not attached)\n  native: #00 pc 000000000004df5c  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+28) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #01 pc 0000000000052664  /apex/com.android.runtime/lib64/bionic/libc.so (__futex_wait_ex(void volatile*, bool, int, bool, timespec const*)+144) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #02 pc 00000000000b56cc  /apex/com.android.runtime/lib64/bionic/libc.so (pthread_cond_wait+76) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #03 pc 00000000000699e0  /system/lib64/libc++.so (std::__1::condition_variable::wait(std::__1::unique_lock<std::__1::mutex>&)+20) (BuildId: 6ae0290e5bfb8abb216bde2a4ee48d9e)\n  native: #04 pc 00000000000a048c  /system/lib64/libgui.so (android::AsyncWorker::run()+112) (BuildId: 383a37b5342fd0249afb25e7134deb33)\n  native: #05 pc 00000000000a0878  /system/lib64/libgui.so (void* std::__1::__thread_proxy<std::__1::tuple<std::__1::unique_ptr<std::__1::__thread_struct, std::__1::default_delete<std::__1::__thread_struct> >, void (android::AsyncWorker::*)(), android::AsyncWorker*> >(void*)+80) (BuildId: 383a37b5342fd0249afb25e7134deb33)\n  native: #06 pc 00000000000b63b0  /apex/com.android.runtime/lib64/bionic/libc.so (__pthread_start(void*)+208) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n  native: #07 pc 00000000000530b8  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 01331f74b0bb2cb958bdc15282b8ec7b)\n\n----- end 10281 -----\n",
          "process_name": "sh.measure.sample",
          "pid": "10281",
          "timestamp": "2024-05-03T23:34:39.675Z"
        }
      ],
      "msr-ee": [
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5127443,
          "end_time": 5127508,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 65,
          "timestamp": "2024-05-03T23:34:18.012Z"
        },
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5127520,
          "end_time": 5127558,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 38,
          "timestamp": "2024-05-03T23:34:18.061Z"
        },
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5127569,
          "end_time": 5127602,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 33,
          "timestamp": "2024-05-03T23:34:18.106Z"
        },
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5127606,
          "end_time": 5127639,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 33,
          "timestamp": "2024-05-03T23:34:18.143Z"
        },
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5127644,
          "end_time": 5127675,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 31,
          "timestamp": "2024-05-03T23:34:18.179Z"
        },
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5137254,
          "end_time": 5137278,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 24,
          "timestamp": "2024-05-03T23:34:27.782Z"
        },
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5137295,
          "end_time": 5137321,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 26,
          "timestamp": "2024-05-03T23:34:27.824Z"
        },
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5137326,
          "end_time": 5137360,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 34,
          "timestamp": "2024-05-03T23:34:27.863Z"
        },
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5137387,
          "end_time": 5137429,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 42,
          "timestamp": "2024-05-03T23:34:27.932Z"
        },
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5137440,
          "end_time": 5137463,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 23,
          "timestamp": "2024-05-03T23:34:27.967Z"
        },
        {
          "event_type": "http",
          "user_defined_attribute": {
            "username": "alice",
            "paid_user": true,
            "credit_balance": 12345,
            "latitude": 30.2661403415387
          },
          "thread_name": "msr-ee",
          "user_triggered": false,
          "url": "http://10.0.2.2:8080/events",
          "method": "put",
          "status_code": 0,
          "start_time": 5137475,
          "end_time": 5137504,
          "request_body": "",
          "response_body": "",
          "failure_reason": "java.net.ConnectException",
          "failure_description": "Failed to connect to /10.0.2.2:8080",
          "request_headers": {},
          "response_headers": {},
          "client": "okhttp",
          "duration": 29,
          "timestamp": "2024-05-03T23:34:28.007Z"
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

Fetch an app's alert preferences for current user.

#### Usage Notes

- App's UUID must be passed in the URI

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

Update an app's alert preferences for current user.

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

### PATCH `/apps/:id/rename`

Modify the name of an app.

#### Usage Notes

- App's UUID must be passed in the URI

#### Request body

  ```json
  {
    "name": "acme app"
  }
  ```

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

### GET `/apps/:id/settings`

Fetch an app's settings.

#### Usage Notes

- App's UUID must be passed in the URI

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
      "retention_period": 30
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

### PATCH `/apps/:id/settings`

Update an app's settings.

#### Usage Notes

- App's UUID must be passed in the URI

#### Request body

  ```json
  {
      "retention_period": 365
  }
  ```

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

### POST `/apps/:id/shortFilters`

Create a shortcode to represent a combination of various app filters.

These shortcodes can then be used in other app APIs which accept different filters. Shortcodes are short-lived, they'll be automatically removed after an hour or so.

#### Usage Notes

- App's UUID must be passed in the URI

#### Request body

  ```json
  {
    "filters": {
      "versions": ["1.0"],
      "version_codes": ["1"],
      "os_names": ["android"],
      "os_versions": ["33"],
      "countries": ["bogon"],
      "network_providers": ["unknown"],
      "network_types": ["wifi"],
      "network_generations": ["unknown"],
      "locales": ["en-US"],
      "device_manufacturers": ["Google"],
      "device_names": ["emu64a"],
      "ud_expression": "{\"and\":[{\"cmp\":{\"key\":\"username\",\"type\":\"string\",\"op\":\"eq\",\"value\":\"alice\"}},{\"cmp\":{\"key\":\"premium_user\",\"type\":\"bool\",\"op\":\"eq\",\"value\":\"true\"}}]}"
    }
  }
  ```

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "filter_short_code" : "86f379b7afd9836d0877eb5c8ff93538"
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

### GET `/apps/:id/spans/roots/names`

Fetch an app's root span names list with optional filters.

#### Usage Notes

- App's UUID must be passed in the URI

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {"results":["activity.onCreate","SampleApp.onCreate"]}
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

### GET `/apps/:id/spans`

Fetch a span's list of instances with optional filters.

#### Usage Notes

- App's UUID must be passed in the URI
- Span name for which instances list is being fetched must be passed as a query param
- Accepted query parameters
  - `span_name` (_required_) - Name of the span for which instances list is being fetched.
  - `from` (_optional_) - ISO8601 timestamp to include sessions after this time.
  - `to` (_optional_) - ISO8601 timestamp to include sessions before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching sessions.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching sessions.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching sessions.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching sessions.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching sessions.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching sessions.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching sessions.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching sessions.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching sessions.
  - `offset` (_optional_) - Number of items to skip when paginating. Use with `limit` parameter to control amount of items fetched.
  - `limit` (_optional_) - Number of items to return. Used for pagination. Should be used along with `offset`.
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `span_statuses` (_optional_) - should be 0 (Unset), 1 (Ok) or 2 (Error). If multiple statuses are required, they should passed as multiple query params like `span_statuses=0&span_statuses=1&span_statuses=2`
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.
- Pass `limit` and `offset` values to paginate results

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "meta": {
        "next": false,
        "previous": false
    },
    "results": [
        {
            "app_id": "e963e98a-aca9-4bab-bd62-70a74801384e",
            "span_name": "activity.onCreate",
            "span_id": "54b40eb484ade006",
            "trace_id": "e0826847053bb9e539c9dc4d4da793ad",
            "status": 0,
            "start_time": "2024-11-18T14:14:55.491Z",
            "end_time": "2024-11-18T14:14:55.573Z",
            "duration": 82,
            "app_version": "0.9.0-SNAPSHOT.debug",
            "app_build": "900",
            "os_name": "android",
            "os_version": "35",
            "device_model": "sdk_gphone16k_arm64",
            "device_manufacturer": "Google"
        },
        {
            "app_id": "e963e98a-aca9-4bab-bd62-70a74801384e",
            "span_name": "activity.onCreate",
            "span_id": "9f1890db9aedb305",
            "trace_id": "d71f3d909689859469a7d9b38e605d56",
            "status": 0,
            "start_time": "2024-11-18T14:14:40.545Z",
            "end_time": "2024-11-18T14:14:40.62Z",
            "duration": 75,
            "app_version": "0.9.0-SNAPSHOT.debug",
            "app_build": "900",
            "os_name": "android",
            "os_version": "35",
            "device_model": "sdk_gphone16k_arm64",
            "device_manufacturer": "Google"
        },
        {
            "app_id": "e963e98a-aca9-4bab-bd62-70a74801384e",
            "span_name": "activity.onCreate",
            "span_id": "0b227c80be4050d8",
            "trace_id": "bba721b7bc78ae746e2c81a5e9e41e7a",
            "status": 0,
            "start_time": "2024-11-18T14:14:33.658Z",
            "end_time": "2024-11-18T14:14:33.743Z",
            "duration": 85,
            "app_version": "0.9.0-SNAPSHOT.debug",
            "app_build": "900",
            "os_name": "android",
            "os_version": "35",
            "device_model": "sdk_gphone16k_arm64",
            "device_manufacturer": "Google"
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

### GET `/apps/:id/spans/plots/metrics`

Fetch a span's metrics plot with optional filters.

#### Usage Notes

- App's UUID must be passed in the URI
- Span name for which metrics plot is being fetched must be passed as a query param
- Accepted query parameters
  - `span_name` (_required_) - Name of the span for which metrics plot is being fetched.
  - `from` (_optional_) - ISO8601 timestamp to include sessions after this time.
  - `to` (_optional_) - ISO8601 timestamp to include sessions before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching sessions.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching sessions.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching sessions.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching sessions.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching sessions.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching sessions.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching sessions.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching sessions.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching sessions.
  - `offset` (_optional_) - Number of items to skip when paginating. Use with `limit` parameter to control amount of items fetched.
  - `limit` (_optional_) - Number of items to return. Used for pagination. Should be used along with `offset`.
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `span_statuses` (_optional_) - should be 0 (Unset), 1 (Ok) or 2 (Error). If multiple status are required, they should passed as multiple query params like `span_statuses=0&span_statuses=1&span_statuses=2`
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.
- Pass `limit` and `offset` values to paginate results

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  [
    {
        "id": "0.9.0-SNAPSHOT.debug (900)",
        "data": [
            {
                "datetime": "2024-11-18",
                "p50": 82,
                "p90": 85,
                "p95": 85,
                "p99": 85
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

### GET `/apps/:id/traces/:traceId`

Fetch a trace.

#### Usage Notes

- App's UUID must be passed in the URI
- Trace Id must be passed in the URI

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "app_id": "e963e98a-aca9-4bab-bd62-70a74801384e",
    "trace_id": "e0826847053bb9e539c9dc4d4da793ad",
    "session_id": "9b33b3cd-2588-46b4-9b1e-19d7d2c462fa",
    "user_id": "",
    "start_time": "2024-11-18T14:14:55.491Z",
    "end_time": "2024-11-18T14:14:55.573Z",
    "duration": 82,
    "app_version": "0.9.0-SNAPSHOT.debug(900)",
    "os_version": "android 35",
    "device_manufacturer": "Google",
    "device_model": "sdk_gphone16k_arm64",
    "network_type": "wifi",
    "spans": [
        {
            "span_name": "activity.onCreate",
            "span_id": "54b40eb484ade006",
            "parent_id": "",
            "status": 0,
            "start_time": "2024-11-18T14:14:55.491Z",
            "end_time": "2024-11-18T14:14:55.573Z",
            "duration": 82,
            "thread_name": "main",
            "device_low_power_mode": false,
            "device_thermal_throttling_enabled": false,
            "checkpoints": []
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

### GET `/apps/:id/bugReports`

Fetch an app's bug reports by applying various optional filters.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` (_optional_) - ISO8601 timestamp to include sessions after this time.
  - `to` (_optional_) - ISO8601 timestamp to include sessions before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching sessions.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching sessions.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching sessions.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching sessions.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching sessions.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching sessions.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching sessions.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching sessions.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching sessions.
  - `free_text` (_optional_) - A sequence of characters used to filter sessions matching various criteria like user_id, description and so on.
  - `bug_report_statuses` (_optional_) - should be 0 (Open) or 1 (Closed). If multiple statuses are required, they should passed as multiple query params like `bug_report_statuses=0&bug_report_statuses=1`
  - `offset` (_optional_) - Number of items to skip when paginating. Use with `limit` parameter to control amount of items fetched.
  - `limit` (_optional_) - Number of items to return. Used for pagination. Should be used along with `offset`.
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.
- Pass `limit` and `offset` values to paginate results

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "meta": {
      "next": true,
      "previous": false
    },
    "results": [
      {
        "session_id": "da388337-f9cd-45cb-8349-2beece91b6e3",
        "app_id": "47cf0390-b11c-4e1f-8f8a-770bf9c159bb",
        "event_id": "e715585e-e5fb-4b37-86cf-0d9de14e1d61",
        "status": 0,
        "description": "Unresponsive button. Kept tapping but nothing happens",
        "timestamp": "2024-12-16T03:31:07.127Z",
        "updated_at": "2024-12-16T03:31:07.127Z",
        "attribute": {
          "installation_id": "00000000-0000-0000-0000-000000000000",
          "app_version": "0.9.0-SNAPSHOT.debug",
          "app_build": "900",
          "app_unique_id": "",
          "measure_sdk_version": "",
          "platform": "",
          "thread_name": "",
          "user_id": "",
          "device_name": "emu64a",
          "device_model": "sdk_gphone64_arm64",
          "device_manufacturer": "Google",
          "device_type": "",
          "device_is_foldable": false,
          "device_is_physical": false,
          "device_density_dpi": 0,
          "device_width_px": 0,
          "device_height_px": 0,
          "device_density": 0,
          "device_locale": "",
          "device_low_power_mode": false,
          "device_thermal_throttling_enabled": false,
          "device_cpu_arch": "",
          "os_name": "android",
          "os_version": "34",
          "os_page_size": 0,
          "network_type": "",
          "network_provider": "",
          "network_generation": ""
        },
        "user_defined_attribute": null,
        "attachments": null,
        "matched_free_text": ""
      },
      {
        "session_id": "a2768feb-59cd-433f-bf00-d36ab297eddb",
        "app_id": "47cf0390-b11c-4e1f-8f8a-770bf9c159bb",
        "event_id": "eaaa0100-0e27-4706-9705-53b5d0b537ef",
        "status": 0,
        "description": "This app sucks!",
        "timestamp": "2024-11-18T14:14:41.622Z",
        "updated_at": "2024-11-18T14:14:41.622Z",
        "attribute": {
          "installation_id": "00000000-0000-0000-0000-000000000000",
          "app_version": "0.9.0-SNAPSHOT.debug",
          "app_build": "900",
          "app_unique_id": "",
          "measure_sdk_version": "",
          "platform": "",
          "thread_name": "",
          "user_id": "",
          "device_name": "emu64a16k",
          "device_model": "sdk_gphone16k_arm64",
          "device_manufacturer": "Google",
          "device_type": "",
          "device_is_foldable": false,
          "device_is_physical": false,
          "device_density_dpi": 0,
          "device_width_px": 0,
          "device_height_px": 0,
          "device_density": 0,
          "device_locale": "",
          "device_low_power_mode": false,
          "device_thermal_throttling_enabled": false,
          "device_cpu_arch": "",
          "os_name": "android",
          "os_version": "35",
          "os_page_size": 0,
          "network_type": "",
          "network_provider": "",
          "network_generation": ""
        },
        "user_defined_attribute": null,
        "attachments": null,
        "matched_free_text": ""
      },
      {
        "session_id": "15c351ac-f92e-4ee7-b8e8-2511af71a696",
        "app_id": "47cf0390-b11c-4e1f-8f8a-770bf9c159bb",
        "event_id": "27899d97-beeb-462d-863d-0833e998822b",
        "status": 0,
        "description": "Screen too slow to load. I'm switching to another app!!!",
        "timestamp": "2024-11-14T04:55:19.37Z",
        "updated_at": "2024-11-14T04:55:19.37Z",
        "attribute": {
          "installation_id": "00000000-0000-0000-0000-000000000000",
          "app_version": "0.9.0-SNAPSHOT.debug",
          "app_build": "900",
          "app_unique_id": "",
          "measure_sdk_version": "",
          "platform": "",
          "thread_name": "",
          "user_id": "",
          "device_name": "emu64a16k",
          "device_model": "sdk_gphone16k_arm64",
          "device_manufacturer": "Google",
          "device_type": "",
          "device_is_foldable": false,
          "device_is_physical": false,
          "device_density_dpi": 0,
          "device_width_px": 0,
          "device_height_px": 0,
          "device_density": 0,
          "device_locale": "",
          "device_low_power_mode": false,
          "device_thermal_throttling_enabled": false,
          "device_cpu_arch": "",
          "os_name": "android",
          "os_version": "35",
          "os_page_size": 0,
          "network_type": "",
          "network_provider": "",
          "network_generation": ""
        },
        "user_defined_attribute": null,
        "attachments": null,
        "matched_free_text": ""
      },
      {
        "session_id": "e19be4bf-0896-42bf-a4a0-ba4529c57f1e",
        "app_id": "47cf0390-b11c-4e1f-8f8a-770bf9c159bb",
        "event_id": "ea5f4312-af64-47f5-9d36-e7ad5b00362c",
        "status": 1,
        "description": "Can't click button. Screen frozen.",
        "timestamp": "2024-07-25T07:26:16.44Z",
        "updated_at": "2024-07-25T07:26:16.44Z",
        "attribute": {
          "installation_id": "00000000-0000-0000-0000-000000000000",
          "app_version": "1.0",
          "app_build": "1",
          "app_unique_id": "",
          "measure_sdk_version": "",
          "platform": "",
          "thread_name": "",
          "user_id": "",
          "device_name": "emu64a",
          "device_model": "sdk_gphone64_arm64",
          "device_manufacturer": "Google",
          "device_type": "",
          "device_is_foldable": false,
          "device_is_physical": false,
          "device_density_dpi": 0,
          "device_width_px": 0,
          "device_height_px": 0,
          "device_density": 0,
          "device_locale": "",
          "device_low_power_mode": false,
          "device_thermal_throttling_enabled": false,
          "device_cpu_arch": "",
          "os_name": "android",
          "os_version": "33",
          "os_page_size": 0,
          "network_type": "",
          "network_provider": "",
          "network_generation": ""
        },
        "user_defined_attribute": null,
        "attachments": null,
        "matched_free_text": ""
      },
      {
        "session_id": "54cb0c7a-9467-4f3b-b053-dfea451a1e4a",
        "app_id": "47cf0390-b11c-4e1f-8f8a-770bf9c159bb",
        "event_id": "d3c0c6ff-f05a-466e-b84a-c4ff236ee7c3",
        "status": 0,
        "description": "Clicking button leads to crash.",
        "timestamp": "2024-06-13T13:37:23.33Z",
        "updated_at": "2024-06-13T13:37:23.33Z",
        "attribute": {
          "installation_id": "00000000-0000-0000-0000-000000000000",
          "app_version": "1.0",
          "app_build": "1",
          "app_unique_id": "",
          "measure_sdk_version": "",
          "platform": "",
          "thread_name": "",
          "user_id": "",
          "device_name": "emu64a",
          "device_model": "sdk_gphone64_arm64",
          "device_manufacturer": "Google",
          "device_type": "",
          "device_is_foldable": false,
          "device_is_physical": false,
          "device_density_dpi": 0,
          "device_width_px": 0,
          "device_height_px": 0,
          "device_density": 0,
          "device_locale": "",
          "device_low_power_mode": false,
          "device_thermal_throttling_enabled": false,
          "device_cpu_arch": "",
          "os_name": "android",
          "os_version": "33",
          "os_page_size": 0,
          "network_type": "",
          "network_provider": "",
          "network_generation": ""
        },
        "user_defined_attribute": null,
        "attachments": null,
        "matched_free_text": ""
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

### GET `/apps/:id/bugReports/plots/instances`

Fetch an app's bug report instances plot by applying various optional filters.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` (_optional_) - ISO8601 timestamp to include sessions after this time.
  - `to` (_optional_) - ISO8601 timestamp to include sessions before this time.
  - `versions` (_optional_) - List of comma separated version identifier strings to return only matching sessions.
  - `version_codes` (_optional_) - List of comma separated version codes to return only matching sessions.
  - `countries` (_optional_) - List of comma separated country identifier strings to return only matching sessions.
  - `device_names` (_optional_) - List of comma separated device name identifier strings to return only matching sessions.
  - `device_manufacturers` (_optional_) - List of comma separated device manufacturer identifier strings to return only matching sessions.
  - `locales` (_optional_) - List of comma separated device locale identifier strings to return only matching sessions.
  - `network_providers` (_optional_) - List of comma separated network provider identifier strings to return only matching sessions.
  - `network_types` (_optional_) - List of comma separated network type identifier strings to return only matching sessions.
  - `network_generations` (_optional_) - List of comma separated network generation identifier strings to return only matching sessions.
  - `free_text` (_optional_) - A sequence of characters used to filter sessions matching various criteria like user_id, description and so on.
  - `bug_report_statuses` (_optional_) - should be 0 (Open) or 1 (Closed). If multiple statuses are required, they should passed as multiple query params like `bug_report_statuses=0&bug_report_statuses=1`
  - `offset` (_optional_) - Number of items to skip when paginating. Use with `limit` parameter to control amount of items fetched.
  - `limit` (_optional_) - Number of items to return. Used for pagination. Should be used along with `offset`.
  - `filter_short_code` (_optional_) - Code representing combination of filters.
  - `ud_expression` (_optional_) - Expression in JSON to filter using user defined attributes.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.
- Pass `limit` and `offset` values to paginate results

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  [
    {
      "id": "1.0 (1)",
      "data": [
        {
          "datetime": "2024-05-24",
          "instances": 3
        },
        {
          "datetime": "2024-06-13",
          "instances": 1
        },
        {
          "datetime": "2024-07-25",
          "instances": 1
        }
      ]
    },
    {
      "id": "0.9.0-SNAPSHOT.debug (900)",
      "data": [
        {
          "datetime": "2024-11-14",
          "instances": 1
        },
        {
          "datetime": "2024-11-18",
          "instances": 1
        },
        {
          "datetime": "2024-12-16",
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

### GET `/apps/:id/bugReports/:bugReportId`

Fetch a bug report.

#### Usage Notes

- App's UUID must be passed in the URI
- Bug report Id must be passed in the URI

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "session_id": "a2768feb-59cd-433f-bf00-d36ab297eddb",
    "app_id": "47cf0390-b11c-4e1f-8f8a-770bf9c159bb",
    "event_id": "eaaa0100-0e27-4706-9705-53b5d0b537ef",
    "status": 0,
    "description": "This app sucks!",
    "timestamp": "2024-11-18T14:14:41.622Z",
    "updated_at": "2024-11-18T14:14:41.622Z",
    "attribute": {
      "installation_id": "00000000-0000-0000-0000-000000000000",
      "app_version": "0.9.0-SNAPSHOT.debug",
      "app_build": "900",
      "app_unique_id": "",
      "measure_sdk_version": "",
      "platform": "",
      "thread_name": "",
      "user_id": "",
      "device_name": "emu64a16k",
      "device_model": "sdk_gphone16k_arm64",
      "device_manufacturer": "Google",
      "device_type": "",
      "device_is_foldable": false,
      "device_is_physical": false,
      "device_density_dpi": 0,
      "device_width_px": 0,
      "device_height_px": 0,
      "device_density": 0,
      "device_locale": "en-US",
      "device_low_power_mode": false,
      "device_thermal_throttling_enabled": false,
      "device_cpu_arch": "",
      "os_name": "android",
      "os_version": "35",
      "os_page_size": 0,
      "network_type": "wifi",
      "network_provider": "unknown",
      "network_generation": "unknown"
    },
    "user_defined_attribute": {
      "discount": true,
      "plan": "free"
    },
    "attachments": [
      {
        "id": "c2001daa-bdc6-476e-b896-0fd047fb2503",
        "name": "screenshot.webp",
        "type": "screenshot",
        "key": "c2001daa-bdc6-476e-b896-0fd047fb2503.webp",
        "location": "http://localhost:8080/attachments?payload=%2Fmsr-attachments-sandbox%2Fc2001daa-bdc6-476e-b896-0fd047fb2503.webp%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Credential%3Dminio%252F20250219%252Fus-east-1%252Fs3%252Faws4_request%26X-Amz-Date%3D20250219T122113Z%26X-Amz-Expires%3D172800%26X-Amz-SignedHeaders%3Dhost%26x-id%3DGetObject%26X-Amz-Signature%3Dd96ffacad1239048baeb104dc93d622cdd4eae58d05f4f8fc3f2a41826685d50"
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

### PATCH `/apps/:id/bugReports/:bugReportId`

Update a bug reports's status.

#### Usage Notes

- App's UUID must be passed in the URI
- Bug report Id must be passed in the URI
- Status should be 0 (Open) or 1 (Closed)

#### Request body

  ```json
  {
      "status": 1
  }
  ```

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

### GET `/apps/:id/alerts`

Fetch an app's alerts by applying various optional filters.

#### Usage Notes

- App's UUID must be passed in the URI
- Accepted query parameters
  - `from` (_optional_) - ISO8601 timestamp to include sessions after this time.
  - `to` (_optional_) - ISO8601 timestamp to include sessions before this time.
  - `offset` (_optional_) - Number of items to skip when paginating. Use with `limit` parameter to control amount of items fetched.
  - `limit` (_optional_) - Number of items to return. Used for pagination. Should be used along with `offset`.
  - `filter_short_code` (_optional_) - Code representing combination of filters.
- For multiple comma separated fields, make sure no whitespace characters exist before or after comma.
- Pass `limit` and `offset` values to paginate results

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "meta": {
        "next": true,
        "previous": false
    },
    "results": [
        {
            "id": "83e9d75c-b3df-432f-af80-ac6f60a9a36e",
            "team_id": "29f0f5b2-f03f-4dbe-bd18-acf163b91965",
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "entity_id": "09ef78940bd258030ebe3937bf1e32a2",
            "type": "anr_spike",
            "message": "ANRs are spiking at CpuUsageCollector: run() - Application Not Responding for at least 5s",
            "url": "http://localhost:3000/29f0f5b2-f03f-4dbe-bd18-acf163b91965/anrs/19e26d60-2ad8-4ef7-8aab-333e1f5377fc/09ef78940bd258030ebe3937bf1e32a2/sh.measure.android.anr.AnrError@CpuUsageCollector",
            "created_at": "2025-07-10T11:35:48.069383Z",
            "updated_at": "2025-07-10T11:35:48.069383Z"
        },
        {
            "id": "003e09e7-b8cf-45c6-b714-2c3149909fc5",
            "team_id": "29f0f5b2-f03f-4dbe-bd18-acf163b91965",
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "entity_id": "19f5125829c0477f56a6e610cd81b735",
            "type": "anr_spike",
            "message": "ANRs are spiking at Thread.java: sleep() - Application Not Responding for at least 5s",
            "url": "http://localhost:3000/29f0f5b2-f03f-4dbe-bd18-acf163b91965/anrs/19e26d60-2ad8-4ef7-8aab-333e1f5377fc/19f5125829c0477f56a6e610cd81b735/sh.measure.android.anr.AnrError@Thread.java",
            "created_at": "2025-07-10T11:35:48.065612Z",
            "updated_at": "2025-07-10T11:35:48.065613Z"
        },
        {
            "id": "865363ff-f960-492d-8a67-a134f242d290",
            "team_id": "29f0f5b2-f03f-4dbe-bd18-acf163b91965",
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "entity_id": "f94859bc4b47fbf05b4eec2a300de0a4",
            "type": "crash_spike",
            "message": "Crashes are spiking at ExceptionDemoActivity: onClick() - This is a nested custom exception",
            "url": "http://localhost:3000/29f0f5b2-f03f-4dbe-bd18-acf163b91965/crashes/19e26d60-2ad8-4ef7-8aab-333e1f5377fc/f94859bc4b47fbf05b4eec2a300de0a4/sh.measure.sample.CustomException@ExceptionDemoActivity",
            "created_at": "2025-07-10T11:35:48.057192Z",
            "updated_at": "2025-07-10T11:35:48.057192Z"
        },
        {
            "id": "e9b43259-bf7b-4f32-98d8-8195891e1aab",
            "team_id": "29f0f5b2-f03f-4dbe-bd18-acf163b91965",
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "entity_id": "2ca7a0d943d923ee99af0e94d89ee0bc",
            "type": "crash_spike",
            "message": "Crashes are spiking at ExceptionDemoActivity: onClick() - Failed to allocate a 104857616 byte allocation with 25165824 free bytes and 88MB until OOM, target footprint 133174272, growth limit 201326592",
            "url": "http://localhost:3000/29f0f5b2-f03f-4dbe-bd18-acf163b91965/crashes/19e26d60-2ad8-4ef7-8aab-333e1f5377fc/2ca7a0d943d923ee99af0e94d89ee0bc/java.lang.OutOfMemoryError@ExceptionDemoActivity",
            "created_at": "2025-07-10T11:35:48.052805Z",
            "updated_at": "2025-07-10T11:35:48.052806Z"
        },
        {
            "id": "2161d773-c822-47a3-9df7-da6f33f67e6a",
            "team_id": "29f0f5b2-f03f-4dbe-bd18-acf163b91965",
            "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
            "entity_id": "e60607f81e351b2e9596faa8eb853e70",
            "type": "crash_spike",
            "message": "Crashes are spiking at ZygoteInit.java: main() - Unhandled Exception",
            "url": "http://localhost:3000/29f0f5b2-f03f-4dbe-bd18-acf163b91965/crashes/19e26d60-2ad8-4ef7-8aab-333e1f5377fc/e60607f81e351b2e9596faa8eb853e70/java.lang.IllegalAccessException@ZygoteInit.java",
            "created_at": "2025-07-10T11:35:48.04831Z",
            "updated_at": "2025-07-10T11:35:48.04831Z"
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

### GET `/apps/:id/sessionTargetingRules`

#### Usage Notes


Fetch an app's session targeting rules.

- App's UUID must be passed in the URI
- Accepts no query parameters
- Pass `limit` and `offset` values to paginate results

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

    ```json
    {
      "meta": {
          "next": false,
          "previous": false
      },
      "results": [
          {
              "id": "c5ebde36-575f-4dcb-8eb0-495802a0154d",
              "team_id": "e1977fdc-893e-4694-bbcd-8e7e10ee3b34",
              "app_id": "3082f92d-f2ce-4477-a371-789911ab78ad",
              "name": "Rule 2",
              "status": 1,
              "sampling_rate": 1.122123,
              "rule": "(event_type == \"custom\" event.user_defined_attrs.boolean == false)",
              "created_at": "2025-09-23T03:19:22.879673Z",
              "created_by": "soodabhay23@gmail.com",
              "updated_at": "2025-09-23T09:14:37.766358Z",
              "updated_by": "soodabhay23@gmail.com"
          },
          {
              "id": "1ead1ab4-03ba-434f-8928-1f3b908e0e2e",
              "team_id": "e1977fdc-893e-4694-bbcd-8e7e10ee3b34",
              "app_id": "3082f92d-f2ce-4477-a371-789911ab78ad",
              "name": "Rule 1",
              "status": 0,
              "sampling_rate": 100,
              "rule": "(event_type == \"anr\")",
              "created_at": "2025-09-23T06:18:51.618236Z",
              "created_by": "soodabhay23@gmail.com",
              "updated_at": "2025-09-23T09:14:31.615099Z",
              "updated_by": "soodabhay23@gmail.com"
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

### GET `/apps/:id/sessionTargetingRules/:ruleId`

#### Usage Notes

Fetch an app's session targeting rules.

- App's UUID must be passed in the URI
- Accepts no query parameters 

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

    ```json
    {
    "id": "c5ebde36-575f-4dcb-8eb0-495802a0154d",
    "team_id": "e1977fdc-893e-4694-bbcd-8e7e10ee3b34",
    "app_id": "3082f92d-f2ce-4477-a371-789911ab78ad",
    "name": "Rule 2",
    "status": 1,
    "sampling_rate": 1.122123,
    "rule": "(event_type == \"custom\" \u0026\u0026 event.user_defined_attrs.boolean == false)",
    "created_at": "2025-09-23T03:19:22.879673Z",
    "created_by": "foo@email.com",
    "updated_at": "2025-09-23T09:14:37.766358Z",
    "updated_by": "bar@email.com"
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

### POST `/apps/:id/sessionTargetingRules`

#### Usage Notes

Creates a new session targeting rule.

- App's UUID must be passed in the URI
- Accepts no query parameters
- The request body must contain `name`, `status`, `sampling_rate` and `rule`
  - `name` - the name of the rule
  - `status` - represents whether the rule is active or not. Must be either 0 or 1
  - `sampling_rate` - percentage sampling rate. Must be a value between 0 and 100.
  - `rule` - must be a valid CEL expression.

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

    ```json
    {
      "name": "Rule 2",
      "status": 1,
      "sampling_rate": 1.122123,
      "rule": "(event_type == \"custom\" \u0026\u0026 event.user_defined_attrs.boolean == false)",
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

### PATCH `/apps/:id/sessionTargetingRules/:ruleId`

#### Usage Notes

Creates a new session targeting rule.

- App's UUID must be passed in the URI
- Rule ID must be passed in the URI
- The request body may contain: `name`, `status`, `sampling_rate` and `rule`
  - `name` - the name of the rule 
  - `status` - represents whether the rule is active or not. Must be either 0 or 1
  - `sampling_rate` - percentage sampling rate. Must be a value between 0 and 100.
  - `rule` - must be a valid CEL expression.

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

    ```json
    {
      "name": "Rule Name",
      "status": 1,
      "sampling_rate": 1.122123,
      "rule": "(event_type == \"custom\" \u0026\u0026 event.user_defined_attrs.boolean == false)",
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

### GET `/apps/:id/sessionTargetingRules/config`

#### Usage Notes

Fetch an apps session targeting rule config.

- App's UUID must be passed in the URI
- Accepts no query parameters

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

    ```json
    {
    "result": {
        "events": [
            {
                "type": "anr",
                "attrs": [],
                "has_ud_attrs": false
            },
            {
                "type": "bug_report",
                "attrs": [],
                "has_ud_attrs": true
            },
            {
                "type": "custom",
                "attrs": [
                    {
                        "key": "name",
                        "type": "string",
                        "hint": "Enter custom event name"
                    }
                ],
                "has_ud_attrs": true
            }
        ],
        "session_attrs": [
            {
                "key": "app_build",
                "type": "string",
                "hint": "Enter your app's build number"
            },
            {
                "key": "app_version",
                "type": "string",
                "hint": "Enter your app's version"
            }
        ],
        "event_ud_attrs": [
            {
                "key": "long",
                "type": "int64",
            },
            {
                "key": "string",
                "type": "string",
            }
        ],
        "operator_types": {
            "bool": [ "eq", "neq" ],
            "float64": [ "eq", "neq", "gt", "lt", "gte", "lte" ],
            "int64": [ "eq", "neq", "gt", "lt", "gte", "lte" ],
            "string": [ "eq", "neq", "contains", "startsWith" ]
        }
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

## Teams

- [**POST `/teams`**](#post-teams) - Create new team. Access token holder becomes the owner.
- [**GET `/teams`**](#get-teams) - Fetch list of teams of access token holder.
- [**GET `/teams/:id/apps`**](#get-teamsidapps) - Fetch list of apps for a team.
- [**GET `/teams/:id/apps/:id`**](#get-teamsidappsid) - Fetch details of an app for a team.
- [**POST `/teams/:id/apps`**](#post-teamsidapps) - Create a new app for a team.
- [**GET `/teams/:id/invites`**](#get-teamsidinvites) - Fetch valid pending invites for a team.
- [**POST `/teams/:id/invite`**](#post-teamsidinvite) - Invite new members (both existing & non measure users) to a team.
- [**PATCH `/teams/:id/invite/:id`**](#patch-teamsidinviteid) - Resend a team invite.
- [**DELETE `/teams/:id/invite/:id`**](#delete-teamsidinviteid) - Delete a team invite.
- [**PATCH `/teams/:id/rename`**](#patch-teamsidrename) -  Rename a team.
- [**GET `/teams/:id/members`**](#get-teamsidmembers) -  Fetch list of team members for a team.
- [**DELETE `/teams/:id/members/:id`**](#delete-teamsidmembersid) -  Remove a member from a team.
- [**PATCH `/teams/:id/members/:id/role`**](#patch-teamsidmembersid) -  Change role of a member of a team.
- [**GET `/teams/:id/authz`**](#get-teamsidauthz) -  Fetch authorization details of access token holder for a team.
- [**GET `/teams/:id/usage`**](#get-teamsidusage) -  Fetch data usage details for a team.
- [**GET `/teams/:id/slack`**](#get-teamsidslack) -  Fetch Slack details for a team.
- [**PATCH `/teams/:id/slack/status`**](#patch-teamsidslackstatus) -  Update a team's Slack integration status to active or inactive.

### POST `/teams`

Create a new team. Only owners of existing team can create new teams.

#### Authorization &amp; Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

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

  <details>
    <summary>Click to expand</summary>

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
| `201 Created`               | Successful response, no errors.                                                                                        |
| `400 Bad Request`           | Request URI is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the user's access token is invalid or has expired.                                                              |
| `403 Forbidden`             | Requester does not have access to this resource.                                                                       |
| `429 Too Many Requests`     | Rate limit of the requester has crossed maximum limits.                                                                |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                             |

</details>

### GET `/teams`

Fetch list of teams of access token holder.

#### Authorization &amp; Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

### GET `/teams/:id/invites`

Fetch valid pending invites for a team

#### Usage Notes

- Teams's UUID must be passed in the URI as the first ID
- Only valid invites are returned. Expired invites are ignored.

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
    [
      {
          "id": "4ce39d97-f8cd-419c-9a68-36b7d49eab9f",
          "invited_by_user_id": "0c367906-7a66-4103-a3ae-cb40a40def35",
          "invited_by_email": "admin@acme.com",
          "invited_to_team_id": "00000000-0000-0000-0000-000000000000",
          "role": "admin",
          "email": "member1@acme.com",
          "created_at": "2025-04-26T12:57:33.463326Z",
          "updated_at": "2025-04-26T12:57:33.463326Z",
          "valid_until": "2025-04-28T12:57:33.463326Z"
      },
      {
          "id": "8c618258-8c35-4d52-9880-7b1f1de85a53",
          "invited_by_user_id": "0c367906-7a66-4103-a3ae-cb40a40def35",
          "invited_by_email": "owner@acme.com",
          "invited_to_team_id": "00000000-0000-0000-0000-000000000000",
          "role": "developer",
          "email": "member2@acme.com",
          "created_at": "2025-04-26T12:57:41.236412Z",
          "updated_at": "2025-04-26T12:57:41.236412Z",
          "valid_until": "2025-04-28T12:57:41.236412Z"
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

### POST `/teams/:id/invite`

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

### PATCH `/teams/:id/invite/:id`

Resend a team invite

#### Usage Notes

- Teams's UUID must be passed in the URI
- Invite's UUID must be passed in the URI

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "ok":"Resent invite 3bbc91df-9ad8-445a-b60b-9ca603140cd1"
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

### DELETE `/teams/:id/invite/:id`

Delete a team invite

#### Usage Notes

- Teams's UUID must be passed in the URI
- Invite's UUID must be passed in the URI

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
  {
    "ok":"Removed invite 3bbc91df-9ad8-445a-b60b-9ca603140cd1"
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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

Fetch authorization details of members for a team. Oldest members appear first in the list of members.

#### Usage Notes

- Teams's UUID must be passed in the URI
- The `can_invite` field in the response indicates what roles new team members can be invited as by the current user
- The `can_change_roles` field in the `authz` field in the response indicates what roles the current user is allowed to assign for that particular member
- The `can_remove` flag in the `authz` field in the response indicates whether the current user is allowed to remove that particular member from the team

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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

### GET `/teams/:id/usage`

Fetch data usage details for a team. Returns data for 3 months including current month.

#### Usage Notes

- Teams's UUID must be passed in the URI

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
    [
      {
          "app_id": "b5417416-5b61-42c5-8e21-862e4b8c3b36",
          "app_name": "Wikipedia",
          "monthly_app_usage": [
              {
                  "month_year": "Jun 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Jul 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Aug 2025",
                  "event_count": 1374,
                  "session_count": 0,
                  "trace_count": 71,
                  "span_count": 71
              }
          ]
      },
      {
          "app_id": "8af8fb8e-e37a-4b56-82a0-905c12852240",
          "app_name": "iOS Wikipedia",
          "monthly_app_usage": [
              {
                  "month_year": "Jun 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Jul 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Aug 2025",
                  "event_count": 5907,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              }
          ]
      },
      {
          "app_id": "36213dc3-fb23-454f-be9f-94cb327a4823",
          "app_name": "Flutter Sample iOS Debug",
          "monthly_app_usage": [
              {
                  "month_year": "Jun 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Jul 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Aug 2025",
                  "event_count": 463,
                  "session_count": 0,
                  "trace_count": 6,
                  "span_count": 10
              }
          ]
      },
      {
          "app_id": "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
          "app_name": "Sample",
          "monthly_app_usage": [
              {
                  "month_year": "Jun 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Jul 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Aug 2025",
                  "event_count": 5003,
                  "session_count": 38,
                  "trace_count": 407,
                  "span_count": 518
              }
          ]
      },
      {
          "app_id": "1156ec93-1e69-4952-a470-31af0de94497",
          "app_name": "iOS Sample",
          "monthly_app_usage": [
              {
                  "month_year": "Jun 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Jul 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Aug 2025",
                  "event_count": 2306,
                  "session_count": 0,
                  "trace_count": 32,
                  "span_count": 32
              }
          ]
      },
      {
          "app_id": "f220a1b1-0738-43be-820c-4225f7b12698",
          "app_name": "Flutter Sample Android",
          "monthly_app_usage": [
              {
                  "month_year": "Jun 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Jul 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Aug 2025",
                  "event_count": 196,
                  "session_count": 0,
                  "trace_count": 1,
                  "span_count": 1
              }
          ]
      },
      {
          "app_id": "816b93d6-1d01-45a9-81b8-e363dbdf314c",
          "app_name": "Flutter Sample Android Debug",
          "monthly_app_usage": [
              {
                  "month_year": "Jun 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Jul 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Aug 2025",
                  "event_count": 391,
                  "session_count": 0,
                  "trace_count": 7,
                  "span_count": 11
              }
          ]
      },
      {
          "app_id": "6ee68015-8da7-46fb-8afb-c25394e2bdf3",
          "app_name": "Flutter Sample iOS",
          "monthly_app_usage": [
              {
                  "month_year": "Jun 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Jul 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Aug 2025",
                  "event_count": 110,
                  "session_count": 0,
                  "trace_count": 3,
                  "span_count": 3
              }
          ]
      },
      {
          "app_id": "426c19c0-e0ef-4c82-a3e0-4802cf0e7bd1",
          "app_name": "PocketCasts",
          "monthly_app_usage": [
              {
                  "month_year": "Jun 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Jul 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
              },
              {
                  "month_year": "Aug 2025",
                  "event_count": 0,
                  "session_count": 0,
                  "trace_count": 0,
                  "span_count": 0
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

### GET `/teams/:id/slack`

Fetch Slack details for a team. Returns Slack workspace name and active or inactive status if team has slack connected. Returns null if team doesn't have Slack connected.

#### Usage Notes

- Teams's UUID must be passed in the URI

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

  ```json
    {
      "slack_team_name":"Measure",
      "is_active":true
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

### PATCH `/teams/:id/slack/status`

Update active or inactive status for a team's Slack integration.

#### Usage Notes

- Teams's UUID must be passed in the URI as the first ID

#### Request body

```json
{
  "is_active": false
}
```

#### Authorization & Content Type

1. (Optional) Set the sessions's access token in `Authorization: Bearer <access-token>` format unless you are using cookies to send access tokens.

2. Set content type as `Content-Type: application/json; charset=utf-8`

The required headers must be present in each request.

<details>
  <summary>Request Headers - Click to expand</summary>

| **Name**        | **Value**                        |
| --------------- | -------------------------------- |
| `Authorization` | Bearer &lt;user-access-token&gt; |
| `Content-Type`  | application/json; charset=utf-8  |
</details>

#### Response Body

- Response

  <details>
    <summary>Click to expand</summary>

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