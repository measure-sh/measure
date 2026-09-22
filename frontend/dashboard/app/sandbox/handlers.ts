import { jsonResponse, SandboxRoute } from "./query";
import { bugReportsRoutes } from "./bug_reports";
import { errorsRoutes } from "./errors";
import { memoryRoutes } from "./memory";
import { networkRoutes } from "./network";
import { overviewRoutes } from "./overview";
import { sessionsRoutes } from "./sessions";
import { settingsRoutes, teamRoutes } from "./settings";
import { tracesRoutes } from "./traces";

const routes: SandboxRoute[] = [
  ...teamRoutes,
  ...overviewRoutes,
  ...sessionsRoutes,
  ...errorsRoutes,
  ...bugReportsRoutes,
  ...tracesRoutes,
  ...networkRoutes,
  ...memoryRoutes,
  ...settingsRoutes,
];

function pathToRegex(path: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const pattern = path
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        keys.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${pattern}$`), keys };
}

function resourceToRequestParts(
  resource: string | Request | URL,
  init: RequestInit | undefined,
): { pathname: string; url: URL; method: string; body: unknown } {
  let urlStr: string;
  let method = "GET";
  if (resource instanceof Request) {
    urlStr = resource.url;
    method = resource.method || "GET";
  } else if (resource instanceof URL) {
    urlStr = resource.toString();
  } else {
    urlStr = resource;
  }
  if (init?.method) {
    method = init.method;
  }

  const url = new URL(urlStr, "http://sandbox.local");

  let body: unknown = undefined;
  if (typeof init?.body === "string" && init.body.length > 0) {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = undefined;
    }
  }

  return { pathname: url.pathname, url, method: method.toUpperCase(), body };
}

export async function handleSandboxRequest(
  resource: string | Request | URL,
  init?: RequestInit,
): Promise<Response> {
  const { pathname, url, method, body } = resourceToRequestParts(
    resource,
    init,
  );

  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }
    const { regex, keys } = pathToRegex(route.path);
    const match = pathname.match(regex);
    if (!match) {
      continue;
    }
    const params: Record<string, string> = {};
    keys.forEach((key, i) => {
      params[key] = match[i + 1];
    });
    return route.handle({ params, url, body });
  }

  return jsonResponse(
    { error: `Sandbox has no route for ${method} ${pathname}` },
    404,
  );
}
