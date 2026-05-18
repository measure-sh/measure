export type OAuthSignInOptions = {
  clientId: string | undefined;
  options: {
    redirectTo: URL | string;
    next: URL | string;
  };
};

function getRandomValues(len: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(arr, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(input: string): string {
  const base64 = btoa(input);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function encodeOAuthState(path: string = ""): string {
  const state = {
    random: getRandomValues(32),
    path,
  };
  return base64UrlEncode(JSON.stringify(state));
}

export async function signInWithGitHub(
  options: OAuthSignInOptions,
): Promise<{ url?: URL; error?: Error }> {
  if (!options.clientId) {
    throw new Error("`clientId` is required");
  }
  const encodedState = encodeOAuthState(options.options.next.toString());
  const body = JSON.stringify({ type: "init", state: encodedState });
  const res = await fetch("/api/auth/github", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const json = await res.json();

  let error: Error | undefined;
  if (res.status === 400) {
    error = new Error(`Bad request: ${json?.error}`);
  } else if (res.status === 401) {
    error = new Error(`Unauthorized: ${json?.error}`);
  }

  if (error) {
    return { error };
  }

  const oauthUrl = new URL("https://github.com/login/oauth/authorize");
  oauthUrl.searchParams.append("scope", "user:email read:user");
  oauthUrl.searchParams.append("client_id", options.clientId);
  oauthUrl.searchParams.append("state", encodedState);
  oauthUrl.searchParams.append(
    "redirect_uri",
    options.options.redirectTo.toString(),
  );
  return { url: oauthUrl };
}
