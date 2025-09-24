# k6 Load Testing Scripts

This directory contains scripts for load testing the Measure self-hosted service using [k6](https://k6.io/).

## Prerequisites

You must have k6 installed on your system. Please follow the [official k6 installation guide](https://k6.io/docs/getting-started/installation/).

## Scripts

### `ping.ts`

This is a simple health-check script. It sends `GET` requests to the `/ping` endpoint to verify that the service is up and responsive. It's configured to run with 10 virtual users (VUs) for 10 seconds.

### `load.ts`

This is the main load testing script. It simulates traffic from Measure SDKs by sending batches of events and binary attachments to the `/events` ingest endpoint via `PUT` requests.

#### Key Features:

*   **Realistic Simulation**: The script virtualizes `session_id` and `event_id` on each run, ensuring that the backend processes them as unique entities. It also applies a random "clock skew" to event timestamps to simulate data coming from different devices with slightly out-of-sync clocks.
*   **Staged Load Ramping**: The test is configured with stages to gradually ramp up the number of virtual users, sustain the load, and then ramp down. This helps in understanding how the system behaves under increasing stress.
*   **Data Fixtures**: The script uses sample data from `fixtures/sample-app.ts` to simulate different payloads.
*   **Batching**: Requests are sent in parallel batches to generate a higher load.

### `fixtures/sample-app.ts`

This file contains the sample data used by `load.ts`. It exports several datasets with varying payload sizes:

*   `noAttachments`: A minimal session with a couple of events and no attachments.
*   `threeAttachments`: A medium-sized session with events and three binary attachments.
*   `thirteenAttachments`: A heavy session with multiple events and thirteen binary attachments.

To switch between these datasets, you need to modify the import statement in `load.ts`:

```load.ts#L13-13
import { noAttachments as sessionData } from "./fixtures/sample-app.ts";
```

Change `noAttachments` to `threeAttachments` or `thirteenAttachments` to use a different dataset.

## Running the Tests

The following commands assume you are running them from within this directory (`self-host/k6`).

### Ping Test

To run a simple health check against a locally running service:

```sh
k6 run ping.ts
```

To target a remote service, you can set the `URL` environment variable:

```sh
k6 run -e URL=http://localhost:8080/ping ping.ts
```

### Load Test

The `noAttachments` fixture is configured to read the API key from a k6 secret named `sample-app-api-key`. The other fixtures use a hardcoded key. You may need to adjust the key in `fixtures/sample-app.ts` for your environment.

When using the `noAttachments` fixture, you must provide the `sample-app-api-key` secret using the `--secret-source` flag. This allows you to inject secrets from various sources, including a simple mock source for local testing.

To run the load test against a locally running service:

```sh
k6 run --secret-source=mock=sample-app-api-key="YOUR_API_KEY" load.ts
```

To target a remote service, set the `URL` environment variable as well:

```sh
k6 run -e URL=http://localhost:8080/events --secret-source=mock=sample-app-api-key="YOUR_API_KEY" load.ts
```

Replace `"YOUR_API_KEY"` with the actual API key for the sample application. For more advanced secret management, you can use other sources like `file` or integrate with secret managers. Refer to the [k6 secrets documentation](https://k6.io/docs/javascript-api/k6-secrets/) for more details.
