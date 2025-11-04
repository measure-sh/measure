export type HttpData = {
  url: string;
  method: string;
  status_code?: number;
  start_time?: number;
  end_time?: number;
  failure_reason?: string;
  failure_description?: string;
  request_headers?: Record<string, string>;
  response_headers?: Record<string, string>;
  request_body?: string;
  response_body?: string;
  client?: string;
};

export class FetchHttpTracker {
  private static isInstalled = false;

  static install() {
    if (this.isInstalled) return;
    this.isInstalled = true;

    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const start = Date.now();
      const method = init?.method || 'GET';
      const url = typeof input === 'string' ? input : input.toString();

      const httpData: any = {
        url,
        method,
        start_time: start,
        client: 'fetch',
      };

      if (init?.headers) httpData.request_headers = FetchHttpTracker.toHeaderMap(init.headers);

      if (init?.body && FetchHttpTracker.isJsonHeaders(init?.headers)) {
        try {
          httpData.request_body =
            typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
        } catch {}
      }

      try {
        const response = await originalFetch(input, init);
        const end = Date.now();

        httpData.end_time = end;
        httpData.status_code = response.status;

        // --- Headers
        if ((response as any).headers?.map)
          httpData.response_headers = (response as any).headers.map;
        else if (response.headers)
          httpData.response_headers = FetchHttpTracker.toHeaderMap(response.headers);

        // --- Try reading body safely (without consuming)
        if (FetchHttpTracker.isJsonHeaders(httpData.response_headers)) {
          try {
            // only read if possible
            const clone = (response as any).clone?.();
            if (clone) {
              const text = await clone.text();
              httpData.response_body = text;
            } else {
              // React Native fallback: don't consume main response
              httpData.response_body = '[Body skipped - RN fetch limitation]';
            }
          } catch {
            httpData.response_body = '[Unreadable or already consumed body]';
          }
        }

        console.log('[HTTP DATA]', httpData);
        return response;
      } catch (error: any) {
        httpData.end_time = Date.now();
        httpData.failure_reason = error?.name || 'Error';
        httpData.failure_description = error?.message || String(error);
        console.log('[HTTP DATA][ERROR]', httpData);
        throw error;
      }
    };

    console.info('[Measure] FetchHttpTracker (React Native safe) installed');
  }

  private static toHeaderMap(headers: any): Record<string, string> {
    const map: Record<string, string> = {};
    if (!headers) return map;

    if (headers instanceof Headers) {
      headers.forEach((v, k) => (map[k.toLowerCase()] = v));
    } else if (typeof headers === 'object') {
      Object.entries(headers).forEach(([k, v]) => (map[k.toLowerCase()] = String(v)));
    }
    return map;
  }

  private static isJsonHeaders(headers?: any): boolean {
    const map = FetchHttpTracker.toHeaderMap(headers);
    const ct = map['content-type'] || '';
    return ct.includes('application/json');
  }
}
