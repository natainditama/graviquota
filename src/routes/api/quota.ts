import type { APIEvent } from "@solidjs/start/server";
import { fetchUnifiedQuotaData } from "~/lib/quota";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const authHeader = event.request.headers.get("authorization");
  const manualToken = authHeader?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || undefined;

  try {
    const data = await fetchUnifiedQuotaData({
      request: event.request,
      manualToken,
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  } catch (err: any) {
    const message = err?.message || "Failed to retrieve quota data";
    const isValidationError = message.toLowerCase().includes("token") || message.toLowerCase().includes("expired") || message.toLowerCase().includes("invalid");

    return new Response(
      JSON.stringify({
        error: message,
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
  return new Response(JSON.stringify({ error: "Method Not Allowed. Use GET to query quota data." }), {
    status: 405,
    headers: {
      "Content-Type": "application/json",
      Allow: "GET",
    },
  });
}
