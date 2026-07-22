import { env } from "./env";
import { getSupabaseClient } from "./supabase";
import {
  type ApiErrorBody,
  type ApiErrorCode,
  isBlockedDispenseCode,
} from "./types";

/**
 * The only place in the app allowed to fetch the backend (CLAUDE.md rule 4).
 * Attaches the Supabase JWT and normalizes the error envelope so callers can
 * branch on a code instead of parsing a response body.
 */

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /**
   * Gate auto-logout on this, never on `status === 401`. UNAUTHORIZED is the
   * only 401 a browser can receive; INVALID_STATION_KEY is also a 401 but is
   * only ever returned to a Pi sending X-Station-Key, which browsers never do.
   */
  get isSessionExpired() {
    return this.code === "UNAUTHORIZED";
  }

  /** Dispense refused on-chain: show the reason, not a generic toast. */
  get isBlockedDispense() {
    return isBlockedDispenseCode(this.code);
  }

  /** QR token aged past its 30s window — refetch the token and retry once. */
  get isStaleQrToken() {
    return this.code === "INVALID_QR_TOKEN";
  }
}

/** Narrow an unknown JSON body to the documented error envelope. */
function parseErrorBody(body: unknown): ApiErrorBody["error"] | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const { error } = body as Record<string, unknown>;
  if (typeof error !== "object" || error === null) return undefined;
  const { code, message, details } = error as Record<string, unknown>;
  if (typeof code !== "string") return undefined;
  return {
    code: code as ApiErrorCode,
    message: typeof message === "string" ? message : "Request failed.",
    details,
  };
}

/** Status → code, for the cases where we never got a well-formed envelope. */
function fallbackCode(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 400) return "VALIDATION_ERROR";
  if (status >= 502) return "CHAIN_ERROR";
  return "INTERNAL_ERROR";
}

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  /** Serialized as JSON. Use instead of `body`. */
  json?: unknown;
  /** Skip the Authorization header (only /health needs this). */
  anonymous?: boolean;
  /**
   * Abort after this many ms. Browsers impose no fetch timeout of their own,
   * so this exists to bound a genuinely hung request — never set it near the
   * expected duration of a mint or burn, which the backend puts at 20–60s.
   */
  timeoutMs?: number;
}

/** Long enough for a real preprod confirmation, per the backend's guidance. */
export const CHAIN_TIMEOUT_MS = 120_000;

/**
 * Returns the parsed JSON body, or `undefined` for 204 — which
 * GET /stations/current-scan uses to mean "no patient scanned yet."
 */
export async function api<T>(
  path: string,
  { json, anonymous, headers, timeoutMs, ...init }: ApiOptions = {},
): Promise<T | undefined> {
  const res = await fetch(`${env.backendUrl}${path}`, {
    ...init,
    // Prescription and QR state is security-sensitive, cross-device state.
    // The service worker already ignores backend requests; this also bypasses
    // the browser's ordinary HTTP cache for every API call.
    cache: "no-store",
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(anonymous ? {} : await authHeader()),
      ...headers,
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });

  if (res.status === 204) return undefined;

  // A dead backend or a CORS failure never produces JSON; don't let the parse
  // error masquerade as the real problem.
  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const parsed = parseErrorBody(body);
    throw new ApiError(
      parsed?.code ?? fallbackCode(res.status),
      res.status,
      parsed?.message ?? `${res.status} ${res.statusText}`,
      parsed?.details,
    );
  }

  return body as T;
}
