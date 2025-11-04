import type { HttpData } from "./fetchHttpTracker";

export class XMLHttpRequestTracker {
  private static isInstalled = false;

  static install() {
    if (this.isInstalled) return;
    this.isInstalled = true;

    const OriginalXHR = global.XMLHttpRequest;

    class XHRInterceptor extends OriginalXHR {
      private _url?: string;
      private _method?: string;
      private _startTime?: number;
      private _requestHeaders: Record<string, string> = {};

      open(method: string, url: string, ...args: any[]) {
        this._method = method;
        this._url = url;
        super.open(method, url, ...args);
      }

      setRequestHeader(header: string, value: string) {
        this._requestHeaders[header.toLowerCase()] = value;
        super.setRequestHeader(header, value);
      }

      send(body?: any) {
        this._startTime = Date.now();
        const httpData: HttpData = {
          url: this._url!,
          method: this._method!,
          start_time: this._startTime,
          client: "XMLHttpRequest",
          request_headers: this._requestHeaders,
        };

        if (body && XMLHttpRequestTracker.isJsonHeaders(this._requestHeaders)) {
          try {
            httpData.request_body =
              typeof body === "string" ? body : JSON.stringify(body);
          } catch {}
        }

        this.addEventListener("loadend", () => {
          httpData.end_time = Date.now();
          httpData.status_code = this.status;

          const respHeaders = this.getAllResponseHeaders();
          httpData.response_headers =
            XMLHttpRequestTracker.parseHeaderString(respHeaders);

          // 🩹 Safe response body extraction
          try {
            if (
              (this.responseType === "" || this.responseType === "text") &&
              XMLHttpRequestTracker.isJsonHeaders(httpData.response_headers)
            ) {
              httpData.response_body = this.responseText || "";
            } else if (
              this.responseType === "json" &&
              this.response &&
              XMLHttpRequestTracker.isJsonHeaders(httpData.response_headers)
            ) {
              httpData.response_body = JSON.stringify(this.response);
            } else {
              // For blob or other types, skip body capture
              httpData.response_body = "[[non-text-response]]";
            }
          } catch (err) {
            console.warn("Failed to read XHR response safely:", err);
          }

          console.log("[HTTP DATA]", httpData);
        });

        this.addEventListener("error", (e: any) => {
          httpData.end_time = Date.now();
          httpData.failure_reason = "NetworkError";
          httpData.failure_description = e?.message || "Unknown network failure";
          console.log("[HTTP DATA][ERROR]", httpData);
        });

        super.send(body);
      }
    }

    global.XMLHttpRequest = XHRInterceptor;
    console.info("[Measure] XMLHttpRequestTracker installed");
  }

  private static parseHeaderString(headerString: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (!headerString) return headers;
    headerString
      .trim()
      .split(/[\r\n]+/)
      .forEach((line) => {
        const parts = line.split(": ");
        const key = parts.shift()?.toLowerCase();
        const value = parts.join(": ");
        if (key) headers[key] = value;
      });
    return headers;
  }

  private static isJsonHeaders(headers?: any): boolean {
    const ct = headers?.["content-type"] || "";
    return ct.includes("application/json");
  }
}
