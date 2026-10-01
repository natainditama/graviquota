import type { APIEvent } from "@solidjs/start/server";
import { isGoogleConfigured } from "~/lib/env";
import { generateSecureStateToken, buildGoogleAuthorizationUrl } from "~/lib/auth";
import { createAuthStateCookie } from "~/lib/cookie";

export async function GET(event: APIEvent) {
  // Validate that Google OAuth credentials are fully configured in the environment
  if (!isGoogleConfigured) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?error=missing_client_id",
      },
    });
  }

  try {
    // Generate cryptographic state for CSRF protection
    const stateToken = generateSecureStateToken();
    const stateCookie = createAuthStateCookie(stateToken);
    const authUrl = buildGoogleAuthorizationUrl(stateToken);

    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
        "Set-Cookie": stateCookie,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: any) {
    console.error("Error initiating Google authentication:", err?.message || err);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?error=auth_init_failed",
      },
    });
  }
}

export async function POST() {
  return new Response(JSON.stringify({ error: "Method Not Allowed. Use GET to start Google OAuth flow." }), {
    status: 405,
    headers: {
      "Content-Type": "application/json",
      Allow: "GET",
    },
  });
}
