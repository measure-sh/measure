// @ts-nocheck
// biome-ignore-all lint: k6 executes in an embedded JavaScript runtime

// See https://grafana.com/docs/k6/latest/javascript-api/
import { check } from "k6";
import http from "k6/http";

import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";

// Choose among different data sets here
import { noAttachments as sessionData } from "./fixtures/sample-app.ts";

/**
 * Minimum duration (msec) to phase shift timestamps.
 */
const minClockSkewMS = 3000;

/**
 * Maximum duration (msec) to phase shift timestamps.
 */
const maxClockSkewMS = 60000;

/**
 * Count of requests to send in a batch in parallel
 *
 * See https://grafana.com/docs/k6/latest/javascript-api/k6-http/batch/
 */
const batchCount = 5;

/**
 * Random duration to phase shift timestamps.
 */
const clockSkewMS = randomIntBetween(minClockSkewMS, maxClockSkewMS);

/**
 * Compute randomized phased shifted timestamp.
 */
function phaseShift(timestamp: string) {
  // don't modify timestamp if absent
  if (!timestamp) {
    return timestamp;
  }

  let ts = new Date(timestamp).getTime();
  ts += clockSkewMS;

  return new Date(ts).toISOString();
}

// See https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/
export const options = {
  stages: [
    { duration: "1m", target: 10 },
    { duration: "1m", target: 20 },
    { duration: "3m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"], // http errors should be less than 2%
    http_req_duration: ["p(95)<2000"], // 95% requests should be below 2s
  },
  cloud: {
    name: "Simple on/off ramp. Post pooling.",
    distribution: {
      "amazon:us:ashburn": { loadZone: "amazon:us:ashburn", percent: 100 },
    },
    note: "Create simple load, ramping up to a target, sustain for a fixed duration, then ramp down to zero.",
  },
};

const ingestURL = __ENV.URL || "http://localhost:8080/events";

export default function main() {
  const batch = [];

  for (let i = 0; i < batchCount; i++) {
    for (const [_, sd] of sessionData.entries()) {
      const formData = new FormData();
      const sessionIdLUT = new Map();

      const params = {
        headers: {
          "Content-Type": `multipart/form-data; boundary=${formData.boundary}`,
          Authorization: `Bearer ${sd.key}`,
          "msr-req-id": uuidv4(),
        },
      };

      for (const [verKey, verVal] of Object.entries(sd.data)) {
        for (const [_, buildVal] of Object.entries(verVal)) {
          const blobs = buildVal.blobs;
          for (const es of buildVal.eventsAndSpans) {
            for (const ev of es.events) {
              // shallow clone the event object
              const event = Object.assign(Object.create(null), ev);

              // virtualize event id
              event.id = uuidv4();

              // virtualize session id
              const oldId = event["session_id"];
              if (sessionIdLUT.has(oldId)) {
                event["session_id"] = sessionIdLUT.get(oldId);
              } else {
                const sessionId = uuidv4();
                sessionIdLUT.set(oldId, sessionId);
                event["session_id"] = sessionId;
              }

              // phase shift the event timestamp
              event.timestamp = phaseShift(event.timestamp);

              const eventJSON = JSON.stringify(event);
              formData.append("event", eventJSON);

              // attachments property might be null
              if (!event.attachments) {
                continue;
              }

              for (const attachment of event.attachments) {
                if (!blobs[attachment.id]) {
                  console.error(
                    `Missing blob for attachment ${attachment.id} for event ${event.id} for version ${verKey} for app ${sd.name}`,
                  );
                  continue;
                }

                formData.append(`blob-${attachment.id}`, {
                  data: new Uint8Array(blobs[attachment.id]).buffer,
                  filename: attachment.name,
                });
              }
            }
          }
        }
      }

      batch.push({
        method: "PUT",
        url: ingestURL,
        body: formData.body(),
        params,
      });
    }
  }

  const responses = http.batch(batch);

  for (const res of responses) {
    check(res, {
      "is status 202": (r) => r.status === 202,
    });
  }
}
