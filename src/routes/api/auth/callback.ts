import type { APIEvent } from "@solidjs/start/server";
import { exchangeCodeForTokens, fetchGoogleUserProfile } from "~/lib/auth";
import { createSignedSessionCookie, clearAuthStateCookie, readAuthStateCookie } from "~/lib/cookie";
import type { UserSession } from "~/types/quota";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  const clearState = clearAuthStateCookie();

  // Scenario 1: Google OAuth returned an error (e.g. user canceled / access_denied)
  if (error) {
    const headers = new Headers();
    headers.set("Location", `/?error=${encodeURIComponent(error)}`);
    headers.append("Set-Cookie", clearState);
    return new Response(null, { status: 302, headers });
  }

  // Scenario 2: Authorization code is missing from callback
  if (!code) {
    const headers = new Headers();
    headers.set("Location", "/?error=missing_code");
    headers.append("Set-Cookie", clearState);
    return new Response(null, { status: 302, headers });
  }

  // Scenario 3: CSRF State parameter validation
  const storedState = readAuthStateCookie(event.request);
  if (storedState && state && storedState !== state) {
    console.warn("CSRF state mismatch detected in OAuth callback.");

    const headers = new Headers();
    headers.set("Location", "/?error=invalid_oauth_state");
    headers.append("Set-Cookie", clearState);
    return new Response(null, { status: 302, headers });
  }

  try {
    // Scenario 4: Exchange code for Google access token
    const tokens = await exchangeCodeForTokens(code);

    // Scenario 5: Fetch Google user profile
    const profile = await fetchGoogleUserProfile(tokens.access_token);

    // Scenario 6: Construct session payload and issue HMAC-signed session cookie
    const session: UserSession = {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      accessToken: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
    };

    const sessionCookie = createSignedSessionCookie(session);
    const headers = new Headers();

    headers.set("Location", "/");
    headers.set("Cache-Control", "no-store, max-age=0");
    headers.append("Set-Cookie", sessionCookie);
    headers.append("Set-Cookie", clearState);

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (err: any) {
    console.error("OAuth callback processing error:", err?.message || err);

    const headers = new Headers();
    headers.set("Location", `/?error=${encodeURIComponent(err?.message || "auth_failed")}`);
    headers.append("Set-Cookie", clearState);

    return new Response(null, {
      status: 302,
      headers,
    });
  }
}

export async function POST() {
  return new Response(JSON.stringify({ error: "Method Not Allowed. Use GET for OAuth callback." }), {
    status: 405,
    headers: {
      "Content-Type": "application/json",
      Allow: "GET",
    },
  });
}
