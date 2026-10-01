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
 * Fetch real Antigravity / Gemini Code Assist quota using a Google Bearer access token.
 */
export async function fetchGoogleLiveQuota(accessToken: string): Promise<Partial<QuotaData>> {
  // Default tier values used when loadCodeAssist returns no tier info
  let currentTierName = "Google AI Pro";
  let currentTierDescription = "You can upgrade to a Google AI Ultra plan to receive higher rate limits.";
  let upgradeUrl = "https://one.google.com/explore-plan/ai-premium";
  let upgradeBtnText = "Upgrade";

  // The companionProject is required by some endpoints to retrieve per-account quota
  let companionProject: string | undefined = undefined;

  // Antigravity IDE queries these endpoints in this priority order
  const apiEndpoints = ["https://cloudaicompanion.googleapis.com", "https://daily-cloudcode-pa.googleapis.com", "https://cloudcode-pa.googleapis.com"];

  // HTTP headers matching what the Antigravity IDE client sends
  const clientHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": "antigravity/1.11.3",
    "X-Goog-Api-Client": "antigravity/1.11.3 gl-node/22 grpc-node/1.24",
  };

  // Request body matching the Antigravity IDE client metadata format
  const loadCodeAssistBody = JSON.stringify({
    metadata: {
      ideType: "IDE_UNSPECIFIED",
      platform: "PLATFORM_UNSPECIFIED",
      pluginType: "PLUGIN_TYPE_UNSPECIFIED",
      extensionVersion: "1.11.3",
    },
    mode: "FULL_ELIGIBILITY_CHECK",
  });

  // Step 1: loadCodeAssist — resolve user tier and companion project ID
  let loadCodeAssistSucceeded = false;

  for (const base of apiEndpoints) {
    try {
      const res = await fetch(`${base}/v1internal:loadCodeAssist`, {
        method: "POST",
        headers: clientHeaders,
        body: loadCodeAssistBody,
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const body = await res.json();

        // Extract tier from all known response shapes across API versions
        const tier = body.currentTier ?? body.response?.currentTier ?? body.codeAssistTierInfo?.currentTier;

        if (tier) {
          currentTierName = tier.name ?? tier.tierName ?? currentTierName;
          currentTierDescription = tier.upgradeSubscriptionText ?? tier.description ?? tier.subtext ?? currentTierDescription;
          upgradeUrl = tier.upgradeSubscriptionUri ?? tier.upgradeUrl ?? tier.upgradeUri ?? upgradeUrl;
          upgradeBtnText = tier.upgradeButtonText ?? tier.upgradeText ?? upgradeBtnText;
        }

        // Extract the companion project ID required for accurate per-account quota queries
        companionProject = body.cloudaicompanionProject ?? body.cloudAiCompanionProject ?? body.project ?? body.response?.cloudaicompanionProject ?? body.response?.project ?? undefined;

        console.log("[GraviQuota] loadCodeAssist success:", {
          endpoint: base,
          tier: currentTierName,
          companionProject,
        });

        loadCodeAssistSucceeded = true;
        break;
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`[GraviQuota] loadCodeAssist HTTP ${res.status} at ${base}:`, errText.slice(0, 300));
      }
    } catch (err: any) {
      console.warn(`[GraviQuota] loadCodeAssist network error at ${base}:`, err?.message);
    }
  }

  // Step 2: retrieveUserQuotaSummary — fetch actual quota buckets per model group
  // We try multiple project ID formats because different API endpoints and
  // account configurations expect different formats.
  let parsedGroups: ModelQuotaGroup[] = [];

  // Build all project candidate variants to maximise chance of getting data
  const projectCandidates: Array<string | undefined> = [];

  if (companionProject) {
    const normalized = companionProject.startsWith("projects/") ? companionProject : `projects/${companionProject}`;
    const bare = companionProject.startsWith("projects/") ? companionProject.slice("projects/".length) : companionProject;

    // Try with-prefix first (most common for cloudaicompanion endpoint)
    projectCandidates.push(normalized, bare);
  }

  // Also try without any project (works on some endpoints)
  projectCandidates.push(undefined);

  outerLoop: for (const base of apiEndpoints) {
    for (const project of projectCandidates) {
      try {
        const requestBody: Record<string, unknown> = {};
        if (project) {
          requestBody.project = project;
        }

        const res = await fetch(`${base}/v1internal:retrieveUserQuotaSummary`, {
          method: "POST",
          headers: clientHeaders,
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const body = await res.json();

          // Extract groups from all known response shapes
          const rawGroups: unknown[] = (body.groups as unknown[]) ?? (body.response?.groups as unknown[]) ?? (body.quotaSummary?.groups as unknown[]) ?? [];

          console.log("[GraviQuota] retrieveUserQuotaSummary:", {
            endpoint: base,
            project,
            groupCount: rawGroups.length,
            firstGroupSample: rawGroups[0] ? JSON.stringify(rawGroups[0]).slice(0, 400) : "none",
          });

          if (Array.isArray(rawGroups) && rawGroups.length > 0) {
            parsedGroups = rawGroups.map((group: any): ModelQuotaGroup => {
              const rawBuckets: any[] = Array.isArray(group.buckets) ? group.buckets : [];

              const buckets: QuotaBucket[] = rawBuckets.map((b: any): QuotaBucket => {
                // The API returns remainingFraction as a float in [0.0, 1.0]
                // Some legacy endpoints use remainingAmount which may be [0, 100] or [0.0, 1.0]
                let percentage = 0;

                if (typeof b.remainingFraction === "number") {
                  percentage = Math.round(b.remainingFraction * 100);
                } else if (typeof b.remainingAmount === "number") {
                  percentage = b.remainingAmount <= 1.0 ? Math.round(b.remainingAmount * 100) : Math.round(b.remainingAmount);
                }

                // Clamp to valid range [0, 100]
                percentage = Math.min(100, Math.max(0, percentage));

                // Build a human-readable description: use API description, fall back to reset time
                let description: string | undefined = b.description;
                if (!description && b.resetTime) {
                  try {
                    description = `You have used some of your limit, it will fully refresh in ${new Date(b.resetTime).toLocaleString()}.`;
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

            break outerLoop;
          }
        } else {
          const errText = await res.text().catch(() => "");
          console.warn(`[GraviQuota] retrieveUserQuotaSummary HTTP ${res.status} at ${base} (project=${project}):`, errText.slice(0, 300));
        }
      } catch (err: any) {
        console.warn(`[GraviQuota] retrieveUserQuotaSummary network error at ${base} (project=${project}):`, err?.message);
      }
    }
  }

  // Step 3: Build and return the final structured quota response
  if (parsedGroups.length > 0) {
    // Real live quota data fetched successfully
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

  // ⚠️ Fallback: authenticated but no quota groups returned.
  //
  // This happens because:
  //   - The Google OAuth token (cloud-platform scope) does not have the internal
  //     "aicode" scope that the Antigravity IDE desktop client uses. The quota
  //     summary endpoint may silently return empty groups for web OAuth tokens.
  //   - The companionProject may not have been discovered, so the API cannot
  //     associate the request with the correct billing/quota account.
  //
  // We intentionally return 0% rather than fabricating 100% — an honest "unknown"
  // state is always preferable to a misleading full-quota indicator.
  const fallbackDescription = loadCodeAssistSucceeded
    ? "Live quota counters require the Antigravity desktop client bearer token. Your plan tier was detected, but per-model usage data is not accessible via Google OAuth web flow."
    : "Unable to reach the Google Cloud Code API. Check that your token has the cloud-platform scope and that network access to googleapis.com is available.";

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
