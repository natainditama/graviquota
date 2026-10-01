import crypto from "node:crypto";
import { env, isProduction } from "~/lib/env";
import type { UserSession } from "~/types/quota";

export const SESSION_COOKIE_NAME = "graviquota_session";
export const STATE_COOKIE_NAME = "graviquota_oauth_state";

/**
 * Computes HMAC-SHA256 signature for cookie payload integrity
 */
function computeHmacSignature(payload: string): string {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(payload).digest("hex");
}

/**
 * Constant-time signature comparison to prevent timing attacks
 */
function verifyHmacSignature(payload: string, signature: string): boolean {
  try {
    const expected = computeHmacSignature(payload);
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");

    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Helper to extract Cookie header from various Request formats (Web Request or Node req)
 */
function extractCookieHeaderValue(input: any): string | null {
  if (!input) return null;
  if (typeof input?.headers?.get === "function") {
    return input.headers.get("cookie");
  }

  if (typeof input?.headers === "object" && input.headers !== null) {
    return input.headers["cookie"] || input.headers.cookie || null;
  }
  return null;
}

/**
 * Create a signed, HttpOnly session cookie
 */
export function createSignedSessionCookie(session: UserSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64");
  const signature = computeHmacSignature(payload);
  const signedCookieValue = `${payload}.${signature}`;

  const isSecure = isProduction || env.APP_URL.startsWith("https://");
  // 30 days for refresh tokens (2592000s), 7 days standard (604800s)
  const maxAge = session.accessToken?.startsWith("1//") ? 2592000 : 604800;
  return `${SESSION_COOKIE_NAME}=${signedCookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure ? "; Secure" : ""}`;
}

/**
 * Clear signed session cookie
 */
export function clearSignedSessionCookie(): string {
  const isSecure = isProduction || env.APP_URL.startsWith("https://");
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure ? "; Secure" : ""}`;
}

/**
 * Parse and verify signed session from HTTP Request or event object
 */
export function getSessionFromRequest(request: any): UserSession | null {
  const cookieHeader = extractCookieHeaderValue(request);
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const target = cookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!target) return null;

  try {
    const rawValue = target.substring(SESSION_COOKIE_NAME.length + 1);
    const dotIndex = rawValue.indexOf(".");

    if (dotIndex === -1) {
      const jsonStr = Buffer.from(rawValue, "base64").toString("utf8");
      return JSON.parse(jsonStr) as UserSession;
    }

    const payload = rawValue.substring(0, dotIndex);
    const signature = rawValue.substring(dotIndex + 1);

    if (!verifyHmacSignature(payload, signature)) {
      console.warn("Invalid session cookie signature detected.");
      return null;
    }

    const jsonStr = Buffer.from(payload, "base64").toString("utf8");
    const session = JSON.parse(jsonStr) as UserSession;

    if (session.expiresAt && Date.now() > session.expiresAt) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Create short-lived OAuth state cookie for CSRF mitigation
 */
export function createAuthStateCookie(state: string): string {
  const isSecure = isProduction || env.APP_URL.startsWith("https://");
  return `${STATE_COOKIE_NAME}=${state}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=600${isSecure ? "; Secure" : ""}`;
}

/**
 * Clear OAuth state cookie
 */
export function clearAuthStateCookie(): string {
  const isSecure = isProduction || env.APP_URL.startsWith("https://");
  return `${STATE_COOKIE_NAME}=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0${isSecure ? "; Secure" : ""}`;
}

/**
 * Read OAuth state cookie value from HTTP Request or event object
 */
export function readAuthStateCookie(request: any): string | null {
  const cookieHeader = extractCookieHeaderValue(request);
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const target = cookies.find((c) => c.startsWith(`${STATE_COOKIE_NAME}=`));
  if (!target) return null;

  return target.substring(STATE_COOKIE_NAME.length + 1);
}
