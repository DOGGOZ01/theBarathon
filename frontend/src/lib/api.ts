function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  // No explicit override: assume the backend lives on the same host the
  // page was loaded from (port 8000). This makes the app work unmodified
  // whether it's opened via localhost, 127.0.0.1, or a LAN IP (e.g. testing
  // from a phone on the same Wi-Fi) — hardcoding "localhost" here would
  // silently break every fetch on any device that isn't the dev machine
  // itself, since "localhost" resolves to that device, not the server.
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8000/api`;
  }
  return "http://localhost:8000/api";
}

export const API_BASE = resolveApiBase();

// DRF returns two different shapes for errors: a top-level {"detail": "..."}
// for hand-raised ValidationErrors (e.g. LoginView's bad-credentials check),
// but per-field {"username": ["Ce nom d'utilisateur est déjà pris."]} for
// ordinary serializer field validation (e.g. RegisterSerializer). Only
// handling "detail" meant every field-validation error surfaced to the user
// as a meaningless "Request failed (400)" — this pulls the real message out
// of whichever shape actually came back.
function extractErrorMessage(status: number, data: unknown): string {
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if ("detail" in obj) return String(obj.detail);
    for (const value of Object.values(obj)) {
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
      if (typeof value === "string") return value;
    }
  }
  return `Request failed (${status})`;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(extractErrorMessage(status, data));
    this.status = status;
    this.data = data;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

interface RequestOptions extends RequestInit {
  skipAuthRetry?: boolean;
}

async function parseBody(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: isFormData
      ? options.headers
      : { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });

  // Only login/register/refresh must be excluded from the retry-via-refresh
  // path (retrying those would loop or mask bad credentials as a session
  // hiccup). Everything else — including /auth/me/ — needs the retry: the
  // whole "/auth/" prefix was excluded before, so once the 30min access
  // token expired, the next /auth/me/ call (e.g. on a page reload) 401'd
  // without ever attempting a refresh, logging the user out even though
  // their 14-day refresh_token cookie was still valid.
  const isAuthBootstrapPath =
    path.startsWith("/auth/login") || path.startsWith("/auth/register") || path.startsWith("/auth/refresh");
  if (res.status === 401 && !options.skipAuthRetry && !isAuthBootstrapPath) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, skipAuthRetry: true });
    }
  }

  if (!res.ok) {
    const data = await parseBody(res);
    throw new ApiError(res.status, data);
  }

  if (res.status === 204) return null as T;
  return (await parseBody(res)) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "PATCH",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const origin = API_BASE.replace(/\/api\/?$/, "");
  return `${origin}${path}`;
}
