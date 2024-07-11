import { encodeOAuthState } from "./auth";

type OAuthOptions = {
  provider: 'github' | 'google',
  clientId: string | undefined,
  options: {
    redirectTo: URL | string
    next: URL | string
  }
}

let client: MeasureClient | null = null;

class MeasureClient {
  origin: string
  defaultHeaders: Headers

  constructor(origin: string) {
    this.origin = origin;
    this.defaultHeaders = new Headers({
      'Content-Type': `application/json`
    })
  }

  #request(path: string, method: string, opts: { headers?: Headers, body?: string }) {
    const url = new URL(path, this.origin);
    let headers = this.defaultHeaders

    if (opts.headers) {
      for (const [key, value] of opts.headers) {
        headers.set(key, value);
      }
    }

    const req = new Request(url, { headers, method, body: opts.body });
    return fetch(req);
  }

  async oAuthSignin(options: OAuthOptions): Promise<{ url?: URL, error: Error | undefined }> {
    if (!options.clientId) {
      throw new Error("`clientId` is required");
    }

    const state = encodeOAuthState(options.options.next);

    const path = '/auth/github';
    const body = JSON.stringify({ type: "init", state });
    const res = await this.#request(path, 'POST', { body });
    const json = await res.json();

    let error;

    switch (res.status) {
      case 400:
        error = new Error(`Bad request:${json?.error}`);
      case 401:
        error = new Error(`Unauthorized:${json?.error}`);
    }

    if (error) {
      return { error };
    }

    const url = new URL(`https://github.com/login/oauth/authorize?scope=user:email&client_id=${options.clientId}&state=${state}&redirect_uri=${options.options.redirectTo}`);

    return { url, error };
  }

  signout(refreshToken: string) {
    return this.#request("/auth/signout", "DELETE", {
      headers: new Headers({
        'Authorization': `Bearer ${refreshToken}`
      })
    })
  }
}

export const createMeasureClient = (origin: string | undefined) => {
  if (!origin) {
    throw new Error("`origin` is required");
  }
  if (!client) {
    client = new MeasureClient(origin);
  }

  return client;
}