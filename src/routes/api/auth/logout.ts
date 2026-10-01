import type { APIEvent } from "@solidjs/start/server";
import { clearSignedSessionCookie, clearAuthStateCookie } from "~/lib/cookie";

export async function POST(event: APIEvent) {
  const sessionCookie = clearSignedSessionCookie();
  const stateCookie = clearAuthStateCookie();

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  headers.append("Set-Cookie", sessionCookie);
  headers.append("Set-Cookie", stateCookie);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Successfully signed out of Google account session.",
      code: "LOGOUT_SUCCESS",
      details: "Session cookies have been invalidated and authentication state cleared.",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers,
    },
  );
}

export async function GET(event: APIEvent) {
  const sessionCookie = clearSignedSessionCookie();
  const stateCookie = clearAuthStateCookie();

  const headers = new Headers();
  headers.set("Location", "/");
  headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  headers.append("Set-Cookie", sessionCookie);
  headers.append("Set-Cookie", stateCookie);

  return new Response(null, {
    status: 302,
    headers,
  });
}

export async function PUT() {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Method Not Allowed. Use POST or GET to log out.",
      code: "METHOD_NOT_ALLOWED",
      details: "The logout endpoint accepts HTTP POST (for API fetch) or HTTP GET (for browser redirection).",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "GET, POST",
      },
    },
  );
}
