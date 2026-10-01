import crypto from "node:crypto";
import { env } from "~/lib/env";
import type { QuotaData, ModelQuotaGroup, QuotaBucket } from "~/types/quota";

/**
 * Generate a cryptographically secure random state token for OAuth CSRF protection
 */
export function generateSecureStateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Build Google OAuth 2.0 authorization URL
 */
export function buildGoogleAuthorizationUrl(state?: string): string {
  const redirectUri = `${env.APP_URL}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cloud-platform",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  if (state) {
    params.set("state", state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange OAuth authorization code for Google access and refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
}> {
  const redirectUri = `${env.APP_URL}/api/auth/callback`;

  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to exchange authorization code (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Fetch authenticated Google user profile info
 */
export async function fetchGoogleUserProfile(accessToken: string): Promise<{
  email: string;
  name: string;
  picture?: string;
}> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Failed to fetch Google profile (${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * Validate an existing Google Bearer access token with Google's tokeninfo API
 */
export async function validateGoogleAccessToken(accessToken: string): Promise<{ valid: boolean; email?: string; error?: string }> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, {
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      return { valid: true, email: data.email };
    }

    const err = await res.json().catch(() => ({}));
    return {
      valid: false,
      error: err.error_description || "Invalid or expired Google access token.",
    };
  } catch (e: any) {
    return {
      valid: false,
      error: e.message || "Failed to verify token with Google.",
    };
  }
}

/**
 * Attempt one HTTP call to a Cloud Code Assist endpoint.
 * Returns parsed JSON body on HTTP 200, or null with a WARN log on any failure.
 * All failures are always logged at WARN level so they appear in Vercel logs.
 */
async function trySingleApiRequest(label: string, url: string, headers: Record<string, string>, body: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const parsed = await res.json().catch((err: any) => {
        console.warn(`[GraviQuota] ${label} JSON parse error at ${url}:`, err?.message);
        return null;
      });
      return parsed;
    }

    const errText = await res.text().catch(() => "(unreadable)");
    console.warn(`[GraviQuota] ${label} HTTP ${res.status} at ${url}: ${errText.slice(0, 300)}`);
    return null;
  } catch (err: any) {
    console.warn(`[GraviQuota] ${label} network error at ${url}: ${err?.message}`);
    return null;
  }
}

/**
 * Fetch real Antigravity / Gemini Code Assist quota using a Google Bearer access token.
 *
 * Strategy:
 *   1. loadCodeAssist — detect user plan tier and companion project ID
 *   2. retrieveUserQuotaSummary — read remaining quota fraction per model group
 *   3. Return structured QuotaData; fall back to honest 0% if API is inaccessible
 *
 * We try multiple endpoint hosts, API path formats, and request body formats to
 * maximise compatibility across Antigravity IDE API versions.
 */
export async function fetchGoogleLiveQuota(accessToken: string): Promise<Partial<QuotaData>> {
  let currentTierName = "Google AI Pro";
  let currentTierDescription = "You can upgrade to a Google AI Ultra plan to receive higher rate limits.";
  let upgradeUrl = "https://one.google.com/explore-plan/ai-premium";
  let upgradeBtnText = "Upgrade";
  let companionProject: string | undefined = undefined;

  // Minimal headers required for all Cloud Code Assist API requests.
  // We intentionally avoid exotic custom headers that might be blocked.
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  // ---------------------------------------------------------------------------
  // Step 1: loadCodeAssist — resolve user plan tier + companion project ID
  //
  // We try every combination of:
  //   - API endpoint host  (cloudcode-pa, daily-cloudcode-pa, cloudaicompanion)
  //   - API path format    (/v1internal:method  vs  /v1:method)
  //   - Request body       ({} minimal  vs  full metadata object)
  //
  // All failures are logged at WARN level so they appear in Vercel function logs.
  // ---------------------------------------------------------------------------
  const loadCodeAssistAttempts: Array<{ url: string; body: string }> = [];

  // Build all endpoint × path × body combinations
  for (const host of ["https://cloudcode-pa.googleapis.com", "https://daily-cloudcode-pa.googleapis.com", "https://cloudaicompanion.googleapis.com"]) {
    for (const path of ["/v1internal:loadCodeAssist", "/v1:loadCodeAssist"]) {
      for (const body of [
        // Minimal body — most permissive
        "{}",
        // Full metadata body used by Antigravity IDE
        JSON.stringify({
          metadata: {
            ideType: "ANTIGRAVITY",
            platform: "LINUX_AMD64",
            pluginType: "GEMINI",
            extensionVersion: "1.11.3",
          },
          mode: "FULL_ELIGIBILITY_CHECK",
        }),
      ]) {
        loadCodeAssistAttempts.push({ url: `${host}${path}`, body });
      }
    }
  }

  let loadCodeAssistSucceeded = false;

  for (const { url, body } of loadCodeAssistAttempts) {
    const result = await trySingleApiRequest("loadCodeAssist", url, baseHeaders, body);

    if (result !== null) {
      // Extract tier from all known response envelope shapes
      const tier = result.currentTier ?? result.response?.currentTier ?? result.codeAssistTierInfo?.currentTier;

      if (tier) {
        currentTierName = tier.name ?? tier.tierName ?? currentTierName;
        currentTierDescription = tier.upgradeSubscriptionText ?? tier.description ?? tier.subtext ?? currentTierDescription;
        upgradeUrl = tier.upgradeSubscriptionUri ?? tier.upgradeUrl ?? tier.upgradeUri ?? upgradeUrl;
        upgradeBtnText = tier.upgradeButtonText ?? tier.upgradeText ?? upgradeBtnText;
      }

      // Companion project ID is required for accurate per-account quota queries
      companionProject = result.cloudaicompanionProject ?? result.cloudAiCompanionProject ?? result.project ?? result.response?.cloudaicompanionProject ?? result.response?.project ?? undefined;

      // Log success at WARN level so it is always visible in Vercel logs
      console.warn("[GraviQuota] loadCodeAssist SUCCESS:", {
        url,
        tier: currentTierName,
        companionProject,
        rawKeys: Object.keys(result),
      });

      loadCodeAssistSucceeded = true;
      break;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2: retrieveUserQuotaSummary — fetch remaining quota buckets
  //
  // Same strategy: try all endpoint/path combinations, plus project ID variants.
  // Log both successes AND 200 OK responses with empty groups at WARN level.
  // ---------------------------------------------------------------------------
  let parsedGroups: ModelQuotaGroup[] = [];

  // Build all project ID format variants to pass to the API
  const projectVariants: Array<string | undefined> = [];

  if (companionProject) {
    const withPrefix = companionProject.startsWith("projects/") ? companionProject : `projects/${companionProject}`;
    const bareId = companionProject.startsWith("projects/") ? companionProject.slice("projects/".length) : companionProject;
    // Most specific first (with projects/ prefix)
    projectVariants.push(withPrefix, bareId);
  }

  // Also try without a project field — works on some endpoint configurations
  projectVariants.push(undefined);

  const quotaSummaryAttempts: Array<{ url: string; body: string }> = [];

  for (const host of ["https://cloudcode-pa.googleapis.com", "https://daily-cloudcode-pa.googleapis.com", "https://cloudaicompanion.googleapis.com"]) {
    for (const path of ["/v1internal:retrieveUserQuotaSummary", "/v1:retrieveUserQuotaSummary"]) {
      for (const project of projectVariants) {
        const bodyObj: Record<string, unknown> = {};
        if (project) bodyObj.project = project;
        quotaSummaryAttempts.push({ url: `${host}${path}`, body: JSON.stringify(bodyObj) });
      }
    }
  }

  for (const { url, body } of quotaSummaryAttempts) {
    const result = await trySingleApiRequest("retrieveUserQuotaSummary", url, baseHeaders, body);

    if (result !== null) {
      const rawGroups: unknown[] = (result.groups as unknown[]) ?? (result.response?.groups as unknown[]) ?? (result.quotaSummary?.groups as unknown[]) ?? [];

      // Always log the response so we can debug — even when groups is empty
      console.warn("[GraviQuota] retrieveUserQuotaSummary response:", {
        url,
        bodyProject: JSON.parse(body).project ?? "(none)",
        groupCount: rawGroups.length,
        rawKeys: Object.keys(result),
        firstGroup: rawGroups[0] ? JSON.stringify(rawGroups[0]).slice(0, 400) : "(none)",
      });

      if (Array.isArray(rawGroups) && rawGroups.length > 0) {
        parsedGroups = rawGroups.map((group: any): ModelQuotaGroup => {
          const rawBuckets: any[] = Array.isArray(group.buckets) ? group.buckets : [];

          const buckets: QuotaBucket[] = rawBuckets.map((b: any): QuotaBucket => {
            // remainingFraction is a float [0.0, 1.0] from the Cloud Code API.
            // Some legacy endpoints use remainingAmount which may be [0, 100] or [0.0, 1.0].
            let percentage = 0;

            if (typeof b.remainingFraction === "number") {
              percentage = Math.round(b.remainingFraction * 100);
            } else if (typeof b.remainingAmount === "number") {
              percentage = b.remainingAmount <= 1.0 ? Math.round(b.remainingAmount * 100) : Math.round(b.remainingAmount);
            }

            // Clamp to valid range [0, 100]
            percentage = Math.min(100, Math.max(0, percentage));

            // Build human-readable reset description from resetTime if no explicit description
            let description: string | undefined = b.description;
            if (!description && b.resetTime) {
              try {
                const resetDate = new Date(b.resetTime);
                const now = Date.now();
                const diffMs = resetDate.getTime() - now;
                if (diffMs > 0) {
                  const diffDays = Math.floor(diffMs / 86400000);
                  const diffHours = Math.floor((diffMs % 86400000) / 3600000);
                  const diffMins = Math.floor((diffMs % 3600000) / 60000);
                  const parts: string[] = [];
                  if (diffDays > 0) parts.push(`${diffDays} day${diffDays !== 1 ? "s" : ""}`);
                  if (diffHours > 0) parts.push(`${diffHours} hour${diffHours !== 1 ? "s" : ""}`);
                  if (diffMins > 0 && diffDays === 0) parts.push(`${diffMins} minute${diffMins !== 1 ? "s" : ""}`);
                  if (parts.length > 0) {
                    description = `You have used some of your limit, it will fully refresh in ${parts.join(", ")}.`;
                  }
                }
              } catch {
                description = `Resets at ${b.resetTime}`;
              }
            }

            return {
              name: b.displayName ?? b.name ?? "Limit Remaining",
              percentageRemaining: percentage,
              description,
              resetTime: b.resetTime,
              isExhausted: percentage <= 0,
            };
          });

          const groupName: string = group.displayName ?? group.name ?? "AI Models";
          const category: "gemini" | "claude_gpt" = groupName.toLowerCase().includes("gemini") ? "gemini" : "claude_gpt";

          return {
            name: groupName,
            category,
            buckets,
            percentageRemaining: buckets[0]?.percentageRemaining ?? 0,
            isExhausted: (buckets[0]?.percentageRemaining ?? 0) <= 0,
          };
        });

        console.warn("[GraviQuota] Quota groups parsed successfully:", {
          url,
          groupCount: parsedGroups.length,
          gemini: parsedGroups.find((g) => g.category === "gemini")?.buckets?.[0]?.percentageRemaining,
          claudeGpt: parsedGroups.find((g) => g.category === "claude_gpt")?.buckets?.[0]?.percentageRemaining,
        });

        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Step 3: Build the final structured quota response
  // ---------------------------------------------------------------------------

  if (parsedGroups.length > 0) {
    // ✅ Real live quota data — return it directly
    const geminiGroup = parsedGroups.find((g) => g.category === "gemini") ?? parsedGroups[0];
    const claudeGroup = parsedGroups.find((g) => g.category === "claude_gpt") ?? parsedGroups[1] ?? parsedGroups[0];

    return {
      planName: currentTierName,
      planSubtext: currentTierDescription,
      upgradeUrl,
      upgradeButtonText: upgradeBtnText,
      credits: {
        enabled: false,
        title: "Enable AI Credit Overages",
        description:
          "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.",
        learnMoreUrl: "https://cloud.google.com/products/gemini/pricing",
      },
      gemini: {
        name: geminiGroup.name,
        category: "gemini",
        percentageRemaining: geminiGroup.buckets[0]?.percentageRemaining ?? 0,
        isExhausted: (geminiGroup.buckets[0]?.percentageRemaining ?? 0) <= 0,
        buckets: geminiGroup.buckets,
      },
      claudeGpt: {
        name: claudeGroup.name,
        category: "claude_gpt",
        percentageRemaining: claudeGroup.buckets[0]?.percentageRemaining ?? 0,
        isExhausted: (claudeGroup.buckets[0]?.percentageRemaining ?? 0) <= 0,
        buckets: claudeGroup.buckets,
      },
      groups: parsedGroups,
    };
  }

  // ⚠️ Fallback: authenticated but no quota groups returned from any endpoint.
  //
  // Possible reasons:
  //   1. All Cloud Code API paths returned non-200 (endpoint changed / access denied)
  //   2. The API returned HTTP 200 but groups array was empty
  //   3. The Google OAuth web token lacks internal scopes required by the quota API
  //
  // We intentionally do NOT fabricate percentages. 0% + honest description is
  // always better than misleading users with synthetic 100% or silent wrong data.
  const fallbackDescription = loadCodeAssistSucceeded
    ? "Your plan tier was detected but per-model usage counters are not accessible via Google web sign-in. For live quota data, open the Antigravity desktop client and paste your bearer token into the manual token field."
    : "The Antigravity quota API is unreachable. Ensure your network can access cloudcode-pa.googleapis.com and that your token includes the cloud-platform scope. Alternatively, use the manual desktop bearer token option.";

  return {
    planName: currentTierName,
    planSubtext: fallbackDescription,
    upgradeUrl,
    upgradeButtonText: upgradeBtnText,
    credits: {
      enabled: false,
      title: "Enable AI Credit Overages",
      description:
        "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.",
      learnMoreUrl: "https://cloud.google.com/products/gemini/pricing",
    },
    gemini: {
      name: "Gemini Models",
      category: "gemini",
      percentageRemaining: 0,
      isExhausted: false,
      buckets: [
        {
          name: "Weekly Limit Remaining",
          percentageRemaining: 0,
          description: fallbackDescription,
          isExhausted: false,
        },
      ],
    },
    claudeGpt: {
      name: "Claude and GPT models",
      category: "claude_gpt",
      percentageRemaining: 0,
      isExhausted: false,
      buckets: [
        {
          name: "Weekly Limit Remaining",
          percentageRemaining: 0,
          description: fallbackDescription,
          isExhausted: false,
        },
      ],
    },
  };
}
