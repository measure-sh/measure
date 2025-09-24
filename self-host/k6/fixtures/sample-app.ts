// @ts-nocheck
// biome-ignore-all lint: k6 executes in an embedded JavaScript runtime
import { SharedArray } from "k6/data";
import secrets from "k6/secrets";

// Objects in this file depend on the location
// & directory structure of the `session-data`
// directory.
//
// update the locations in open(..) accordingly
// when the session-data directory structure
// changes.

// See
// https://grafana.com/docs/k6/latest/javascript-api/k6-data/sharedarray
// https://grafana.com/docs/k6/latest/using-k6/secret-source/
// https://grafana.com/docs/k6/latest/javascript-api/k6-secrets/

const key = await secrets.get("sample-app-api-key");

/**
 * minimal. no attachments, only a couple of events.
 */
export const noAttachments = new SharedArray("session_data", function () {
  return [
    {
      name: "sh.measure.sample",
      key,
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
                  "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/f25d12ea-3b0c-4832-b343-f919adadd5a8.json",
                ),
              ),
            ],
            blobs: {},
          },
        },
      },
    },
  ];
});

/**
 * medium sized. conains few events and 3 attachments.
 */
export const threeAttachments = new SharedArray("session_data", function () {
  return [
    {
      name: "sh.measure.sample",
      key,
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
                  "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/93463d1e-0187-4f49-be08-298cffec2bb8.json",
                ),
              ),
            ],
            blobs: {
              "05adecec-b215-4367-9d7a-e3f5eec88431": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/05adecec-b215-4367-9d7a-e3f5eec88431",
                "b",
              ),
              "6f6bdc66-0f8e-4daa-9ce4-ef89b1df2a92": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/6f6bdc66-0f8e-4daa-9ce4-ef89b1df2a92",
                "b",
              ),
              "95507fe6-8abe-4538-93bf-e458057e37d0": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/95507fe6-8abe-4538-93bf-e458057e37d0",
                "b",
              ),
            },
          },
        },
      },
    },
  ];
});

/**
 * heavy. contains many events & thirteen attachments.
 */
export const thirteenAttachments = new SharedArray("session_data", function () {
  return [
    {
      name: "sh.measure.sample",
      key,
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
                  "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/0ac0e52b-8d56-484d-b3c8-2283d9829fc1.json",
                ),
              ),
              JSON.parse(
                open(
                  "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/1cd86a1e-dc03-4594-ae9c-897c22901c49.json",
                ),
              ),
            ],
            blobs: {
              "6df4279f-6a5c-4cfb-b0fe-e60b0488e5bd": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/6df4279f-6a5c-4cfb-b0fe-e60b0488e5bd",
                "b",
              ),
              "cc71e7df-82c3-4bd0-ba76-194a8866cb51": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/cc71e7df-82c3-4bd0-ba76-194a8866cb51",
                "b",
              ),
              "c235700d-312e-4e84-9f7c-f5a8ce2a73ff": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/c235700d-312e-4e84-9f7c-f5a8ce2a73ff",
                "b",
              ),
              "5777a57f-09dc-4e08-b431-e42331b07b3b": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/5777a57f-09dc-4e08-b431-e42331b07b3b",
                "b",
              ),
              "5eee9170-5357-4e1d-9864-d6704e67a9f7": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/5eee9170-5357-4e1d-9864-d6704e67a9f7",
                "b",
              ),
              "b79a216c-dd22-4699-b162-0fe5e6bfd6f9": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/b79a216c-dd22-4699-b162-0fe5e6bfd6f9",
                "b",
              ),
              "d9eb8ce2-957a-4295-aea0-68676a07e231": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/d9eb8ce2-957a-4295-aea0-68676a07e231",
                "b",
              ),
              "030c9ae8-b9b6-4436-9ada-4046162a8866": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/030c9ae8-b9b6-4436-9ada-4046162a8866",
                "b",
              ),
              "a463bc60-9f34-423f-86d2-b0afd7f05a02": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/a463bc60-9f34-423f-86d2-b0afd7f05a02",
                "b",
              ),
              "ee00a27a-35e2-4bac-bf59-9b19998da307": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/ee00a27a-35e2-4bac-bf59-9b19998da307",
                "b",
              ),
              "4c2086fd-8e1f-4d81-8d1b-3931efa6329f": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/4c2086fd-8e1f-4d81-8d1b-3931efa6329f",
                "b",
              ),
              "f4487af6-6f87-418e-9816-9b765bcc00da": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/f4487af6-6f87-418e-9816-9b765bcc00da",
                "b",
              ),
              "382764f2-71c7-4f11-a682-fe78e62d15cd": open(
                "../../session-data/sh.measure.sample/0.10.0-SNAPSHOT/blobs/382764f2-71c7-4f11-a682-fe78e62d15cd",
                "b",
              ),
            },
          },
        },
      },
    },
  ];
});
