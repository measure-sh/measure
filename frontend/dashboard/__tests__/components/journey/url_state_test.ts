import {
  decodeNodeIds,
  encodeNodeIds,
  selectionFromUrl,
  selectionIn,
} from "@/app/components/journey/url_state";
import { describe, expect, it } from "@jest/globals";

describe("encodeNodeIds", () => {
  it("gives back the same ids in order, with any characters", async () => {
    const ids = [
      "screen:org.wikipedia.main.MainActivity",
      "event:add_to_cart",
      "screen:/settings?tab=1&x=a b",
      "screen:Café → 結帳",
      'screen:"quoted",comma',
      "fatal",
    ];

    const encoded = await encodeNodeIds(ids);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
    expect(await decodeNodeIds(encoded)).toEqual(ids);
  });

  it("gives back an empty list", async () => {
    expect(await decodeNodeIds(await encodeNodeIds([]))).toEqual([]);
  });

  it.each([
    ["text that is not base64", "%%%"],
    ["base64 that is not deflate", "aGVsbG8"],
  ])("gives null for %s", async (_, value) => {
    expect(await decodeNodeIds(value)).toBeNull();
  });

  it("gives null for JSON that is not a list of strings", async () => {
    const deflated = async (text: string) => {
      const stream = new Response(
        new TextEncoder().encode(text),
      ).body!.pipeThrough(new CompressionStream("deflate-raw"));
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      return btoa(String.fromCharCode(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");
    };

    expect(await decodeNodeIds(await deflated('{"a":1}'))).toBeNull();
    expect(await decodeNodeIds(await deflated("[1,2]"))).toBeNull();
    expect(await decodeNodeIds(await deflated("not json"))).toBeNull();
  });
});

describe("selectionFromUrl", () => {
  const parse = (search: string) =>
    selectionFromUrl(new URLSearchParams(search));

  it.each([
    ["no selection", "", null],
    ["a node", "jn=screen:Home", { node: "screen:Home" }],
    [
      "a link",
      "js=screen:Home&jt=screen:Cart",
      { source: "screen:Home", target: "screen:Cart" },
    ],
    [
      "a path",
      "jp=screen:Home&jp=screen:Cart",
      { path: ["screen:Home", "screen:Cart"] },
    ],
    ["a link without its target", "js=screen:Home", null],
    ["a path of one node", "jp=screen:Home", null],
    [
      "a node and a link, as the node",
      "jn=screen:Home&js=screen:Home&jt=screen:Cart",
      { node: "screen:Home" },
    ],
  ])("reads %s", (_, search, expected) => {
    expect(parse(search)).toEqual(expected);
  });
});

describe("selectionIn", () => {
  const journey = {
    nodes: ["screen:Home", "screen:Cart", "fatal"].map((id) => ({
      id,
      name: id,
      kind: "screen" as const,
      step: 0,
      users: 1,
      continuing: 0,
      median_ms_from_previous: null,
    })),
    links: [
      { source: "screen:Home", target: "screen:Cart", users: 1 },
      { source: "screen:Cart", target: "screen:Home", users: 1 },
      { source: "screen:Cart", target: "fatal", users: 1 },
    ],
    sample_percent: 100,
  };

  it.each([
    [{ node: "screen:Home" }, true],
    [{ node: "screen:Gone" }, false],
    [{ source: "screen:Home", target: "screen:Cart" }, true],
    [{ source: "screen:Home", target: "fatal" }, false],
    [{ path: ["screen:Home", "screen:Cart", "fatal"] }, true],
    [
      { path: ["screen:Home", "screen:Cart", "screen:Home", "screen:Cart"] },
      true,
    ],
    [{ path: ["screen:Home", "fatal"] }, false],
    [{ path: ["screen:Home", "screen:Gone"] }, false],
  ])("checks %j against the journey", (selection, expected) => {
    expect(selectionIn(journey, selection)).toBe(expected);
  });
});
