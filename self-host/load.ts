import { sleep, check } from "k6";
import { SharedArray } from "k6/data";
import http from "k6/http";

import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";

const sessionData = new SharedArray("session_data", function () {
  return [
    {
      name: "sh.measure.sample",
      key: "msrsh_1ba61b6e539afaaf7965c82d6ff11ae9fd87e51c3edf1de8fc29206195cc2477_5604632e",
      data: {
        "0.10.0-SNAPSHOT": {
          "29045653": {
            build: {
              size: "2146833",
              type: "apk",
            },
            eventsAndSpans: [
              JSON.parse(
                open(
                  "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/0ac0e52b-8d56-484d-b3c8-2283d9829fc1.json",
                ),
              ),
              JSON.parse(
                open(
                  "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/1cd86a1e-dc03-4594-ae9c-897c22901c49.json",
                ),
              ),
            ],
            blobs: {
              "6df4279f-6a5c-4cfb-b0fe-e60b0488e5bd": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/6df4279f-6a5c-4cfb-b0fe-e60b0488e5bd",
                "b",
              ),
              "cc71e7df-82c3-4bd0-ba76-194a8866cb51": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/cc71e7df-82c3-4bd0-ba76-194a8866cb51",
                "b",
              ),
              "c235700d-312e-4e84-9f7c-f5a8ce2a73ff": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/c235700d-312e-4e84-9f7c-f5a8ce2a73ff",
                "b",
              ),
              "5777a57f-09dc-4e08-b431-e42331b07b3b": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/5777a57f-09dc-4e08-b431-e42331b07b3b",
                "b",
              ),
              "5eee9170-5357-4e1d-9864-d6704e67a9f7": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/5eee9170-5357-4e1d-9864-d6704e67a9f7",
                "b",
              ),
              "b79a216c-dd22-4699-b162-0fe5e6bfd6f9": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/b79a216c-dd22-4699-b162-0fe5e6bfd6f9",
                "b",
              ),
              "d9eb8ce2-957a-4295-aea0-68676a07e231": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/d9eb8ce2-957a-4295-aea0-68676a07e231",
                "b",
              ),
              "030c9ae8-b9b6-4436-9ada-4046162a8866": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/030c9ae8-b9b6-4436-9ada-4046162a8866",
                "b",
              ),
              "a463bc60-9f34-423f-86d2-b0afd7f05a02": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/a463bc60-9f34-423f-86d2-b0afd7f05a02",
                "b",
              ),
              "ee00a27a-35e2-4bac-bf59-9b19998da307": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/ee00a27a-35e2-4bac-bf59-9b19998da307",
                "b",
              ),
              "4c2086fd-8e1f-4d81-8d1b-3931efa6329f": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/4c2086fd-8e1f-4d81-8d1b-3931efa6329f",
                "b",
              ),
              "f4487af6-6f87-418e-9816-9b765bcc00da": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/f4487af6-6f87-418e-9816-9b765bcc00da",
                "b",
              ),
              "382764f2-71c7-4f11-a682-fe78e62d15cd": open(
                "./session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/382764f2-71c7-4f11-a682-fe78e62d15cd",
                "b",
              ),
            },
          },
        },
      },
    },
  ];
});

// See https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/
export const options = {
  stages: [
    // { duration: "1m", target: 20 },
    // { duration: "3m", target: 20 },
    { duration: "1m", target: 5 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"], // http errors should be less than 2%
    http_req_duration: ["p(95)<2000"], // 95% requests should be below 2s
  },
  cloud: {
    distribution: {
      "amazon:us:ashburn": { loadZone: "amazon:us:ashburn", percent: 100 },
    },
  },
};

// const pingUrl = "https://staging-ingest.measure.sh/ping";
const eventsUrl = "https://staging-ingest.measure.sh/events";

export default function main() {
  // let response = http.get(pingUrl);
  // check(response, {
  //   "is status 200": (r) => r.status === 200,
  // });

  for (const sd of sessionData) {
    const formData = new FormData();
    const params = {
      headers: {
        "Content-Type": `multipart/form-data; boundary=${formData.boundary}`,
        Authorization: `Bearer ${sd.key}`,
        "msr-req-id": uuidv4(),
      },
    };

    for (const [verKey, verVal] of Object.entries(sd.data)) {
      for (const [buildKey, buildVal] of Object.entries(verVal)) {
        // const build = buildVal.build;
        // const eventsAndSpans = buildVal.eventsAndSpans
        const blobs = buildVal.blobs;
        for (const es of buildVal.eventsAndSpans) {
          for (const event of es.events) {
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

    const response = http.put(eventsUrl, formData.body(), params);
    if (response.status !== 202) {
      console.error(`Unexpected status code ${response.status}`);
      console.log(response.body());
    }

    check(response, {
      "is status 202": (r) => r.status === 202,
    });

    sleep(1);
  }
}
