import { z } from "zod";
import { config } from "@/config";
import { logger } from "@/lib/logger";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
    public requestId?: string | null,
  ) {
    super(typeof detail === "string" ? detail : `Request failed (${status})`);
  }
}

/** Access token lives in memory only (never localStorage). The refresh token is an httpOnly cookie. */
let accessToken: string | null = null;
let onAuthFailure: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function hasAccessToken() {
  return accessToken !== null;
}

/** Called when a 401 cannot be fixed by refreshing (e.g. redirect to /login). */
export function setAuthFailureHandler(handler: (() => void) | null) {
  onAuthFailure = handler;
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  if (config.useMockApi) {
    // Demo mode: the mock server is loaded lazily so it never ships in the main bundle.
    const { mockFetch } = await import("@/mocks/server");
    return mockFetch(path, { ...init, headers });
  }
  return fetch(`${config.apiBaseUrl}${path}`, { ...init, headers, credentials: "include" });
}

const refreshSchema = z.object({ access_token: z.string() });

let refreshInFlight: Promise<boolean> | null = null;

/** Rotates the refresh cookie and stores a new access token. Returns false if the session is gone. */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await send("/auth/refresh", { method: "POST" });
      if (!res.ok) return false;
      setAccessToken(refreshSchema.parse(await res.json()).access_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Single HTTP entry point. Every response is validated with a Zod schema. */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  let res = await send(path, init);

  if (res.status === 401 && retryOnUnauthorized && !path.startsWith("/auth/")) {
    if (await refreshSession()) {
      res = await send(path, init);
    } else {
      setAccessToken(null);
      onAuthFailure?.();
    }
  }

  const requestId = res.headers.get("X-Request-Id");
  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    logger.error("api request failed", { path, status: res.status, requestId });
    throw new ApiError(res.status, body?.detail ?? body, requestId);
  }
  logger.debug("api request ok", { path, status: res.status, requestId });
  return schema.parse(body);
}

/** Human-readable message for a failed request. */
export function errorMessage(err: unknown, fallback = "Could not reach the server. Try again."): string {
  if (err instanceof ApiError) {
    if (typeof err.detail === "string") return err.detail;
    if (err.status === 422) return "Please correct the highlighted fields.";
    return err.message;
  }
  return fallback;
}

export const validationDetailSchema = z.array(
  z.object({ loc: z.array(z.union([z.string(), z.number()])), msg: z.string() }),
);

/** FastAPI 422 detail -> [{ path: "a.b.0.c", message }], dropping the leading "body" segment. */
export function fieldErrors(err: unknown): { path: string; message: string }[] {
  if (!(err instanceof ApiError) || err.status !== 422) return [];
  const parsed = validationDetailSchema.safeParse(err.detail);
  if (!parsed.success) return [];
  return parsed.data.map((d) => ({
    path: d.loc.filter((p, i) => !(i === 0 && p === "body")).join("."),
    message: d.msg,
  }));
}
