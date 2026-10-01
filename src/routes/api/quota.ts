import type { APIEvent } from "@solidjs/start/server";
import { fetchUnifiedQuotaData } from "~/lib/quota";
import { createSignedSessionCookie } from "~/lib/cookie";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const authHeader = event.request.headers.get("authorization");
  const manualToken = authHeader?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || undefined;

  try {
    const data = await fetchUnifiedQuotaData({
      request: event.request,
      manualToken,
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");

    if (manualToken && data.user) {
      const sessionCookie = createSignedSessionCookie({
        email: data.user.email,
        name: data.user.name,
        picture: data.user.picture,
        accessToken: manualToken,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      headers.set("Set-Cookie", sessionCookie);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    const message = err?.message || "Failed to retrieve quota data from server";
    const isValidationError = message.toLowerCase().includes("token") || message.toLowerCase().includes("expired") || message.toLowerCase().includes("invalid");

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        code: isValidationError ? "INVALID_ACCESS_TOKEN" : "QUOTA_SERVICE_UNAVAILABLE",
        details: isValidationError
          ? "The provided Google access token is invalid, expired, or rejected by Google OAuth. Please generate a fresh token and try again."
          : "An unexpected error occurred while communicating with the quota service. Verify server connectivity and try again.",
        timestamp: new Date().toISOString(),
      }),
      {
        status: isValidationError ? 401 : 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      },
    );
  }
}

export async function POST() {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Method Not Allowed. Use GET to query quota data.",
      code: "METHOD_NOT_ALLOWED",
      details: "The /api/quota endpoint accepts only HTTP GET requests with optional Bearer authorization headers.",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "GET",
      },
    },
  );
}
