import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { GET, HEAD, POST, PUT } from "@/app/api/[...path]/route";

const UPSTREAM = "http://upstream.internal:8080";

describe("api catch-all route", () => {
  const originalApi = process.env.API_BASE_URL;
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    process.env.API_BASE_URL = UPSTREAM;
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    if (originalApi === undefined) {
      delete process.env.API_BASE_URL;
    } else {
      process.env.API_BASE_URL = originalApi;
    }
  });

  it("forwards url, method, body & forwarding headers", async () => {
    fetchMock.mockResolvedValue(new Response("ok"));
    await POST(
      new Request("https://measure.sh/api/teams/1/apps?limit=10", {
        method: "POST",
        body: "payload",
        headers: { host: "measure.sh", "x-keep": "1" },
        // @ts-expect-error undici option
        duplex: "half",
      }),
    );

    const [url, init] = fetchMock.mock.calls[0];
    const headers = init!.headers as Headers;
    expect(String(url)).toBe(`${UPSTREAM}/teams/1/apps?limit=10`);
    expect(init!.method).toBe("POST");
    expect(await new Response(init!.body as BodyInit).text()).toBe("payload");
    expect(headers.has("host")).toBe(false);
    expect(headers.get("x-keep")).toBe("1");
    expect(headers.get("x-forwarded-host")).toBe("measure.sh");
    expect(headers.get("x-forwarded-proto")).toBe("https");
  });

  it("passes status & set-cookie through, drops encoding & length", async () => {
    const upstreamHeaders = new Headers({
      "content-encoding": "gzip",
      "content-length": "2",
    });
    upstreamHeaders.append("set-cookie", "a=1");
    upstreamHeaders.append("set-cookie", "b=2");
    fetchMock.mockResolvedValue(
      new Response("ok", { status: 201, headers: upstreamHeaders }),
    );

    const res = await GET(new Request("https://measure.sh/api/x"));

    expect(res.status).toBe(201);
    expect(res.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
    expect(res.headers.has("content-encoding")).toBe(false);
    expect(res.headers.has("content-length")).toBe(false);
  });

  it("returns 502 without the upstream host on fetch failure", async () => {
    fetchMock.mockRejectedValue(new Error(`connect ECONNREFUSED ${UPSTREAM}`));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(new Request("https://measure.sh/api/x"));

    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("upstream.internal");
  });

  it.each([
    ["GET", GET, "/api/proxy/attachments?payload=x"],
    ["PUT", PUT, "/api/proxy/attachments?payload=x"],
    ["HEAD", HEAD, "/api/proxy/attachments"],
    ["GET", GET, "/api/PROXY/attachments"],
    ["GET", GET, "/api/proxy"],
    ["GET", GET, "/api/%70roxy/attachments"],
    ["GET", GET, "/api/%2fproxy/attachments"],
    ["GET", GET, "/api//proxy/attachments"],
    ["GET", GET, "/api/%E0%A4%A/x"],
  ])("refuses %s %s with 404 & no fetch", async (method, handler, path) => {
    fetchMock.mockClear();

    const res = await handler(
      new Request(`https://measure.sh${path}`, { method }),
    );

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still forwards paths that only start with proxy", async () => {
    fetchMock.mockResolvedValue(new Response("ok"));

    const res = await GET(new Request("https://measure.sh/api/proxyish"));

    expect(res.status).toBe(200);
  });

  it("throws when API_BASE_URL is unset", async () => {
    delete process.env.API_BASE_URL;
    await expect(GET(new Request("https://measure.sh/api/x"))).rejects.toThrow(
      "API_BASE_URL is not set",
    );
  });
});
