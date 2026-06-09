/**
 * In-memory rate limiter for API routes.
 *
 * Since Haney Chat is deployed as a single instance on Netlify, an
 * in-memory Map works fine.  For multi-instance deployments, replace
 * this with a Redis-backed store.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);
}

export interface RateLimitConfig {
  /** Max requests within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Optional identifier (e.g. user ID, IP) */
  identifier?: string;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check whether a request should be rate-limited.
 *
 * @param config  Limit, window, and identifier
 * @returns       Result with ok, remaining count, and reset time
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const key = config.identifier ?? "global";
  const now = Date.now();
  const entry = store.get(key);

  // Window expired or first request — reset
  if (!entry || entry.resetAt <= now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(key, newEntry);
    return {
      ok: true,
      remaining: config.limit - 1,
      resetAt: new Date(newEntry.resetAt),
    };
  }

  // Within current window
  entry.count += 1;

  if (entry.count > config.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt),
    };
  }

  return {
    ok: true,
    remaining: config.limit - entry.count,
    resetAt: new Date(entry.resetAt),
  };
}

/** Pre-built configs for different endpoint types */

export const CHAT_RATE_LIMIT: RateLimitConfig = {
  limit: 30,
  windowMs: 60_000, // 30 req / minute
};

export const CONVERSATIONS_RATE_LIMIT: RateLimitConfig = {
  limit: 60,
  windowMs: 60_000, // 60 req / minute
};

export const ADMIN_RATE_LIMIT: RateLimitConfig = {
  limit: 100,
  windowMs: 60_000, // 100 req / minute
};

/**
 * Apply rate limiting and return a 429 Response if exceeded.
 * Returns `null` if the request is within limits.
 */
export function rateLimitResponse(
  config: RateLimitConfig & { identifier: string }
): Response | null {
  const result = checkRateLimit(config);
  if (!result.ok) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please slow down.",
        retryAfter: Math.ceil(
          (result.resetAt.getTime() - Date.now()) / 1000
        ),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(
            Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
          ),
        },
      }
    );
  }
  return null;
}
