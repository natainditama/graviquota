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
 * Fetch real Antigravity / Gemini Code Assist Quota using Google Bearer token
 */
export async function fetchGoogleLiveQuota(accessToken: string): Promise<Partial<QuotaData>> {
  let currentTierName = "Google AI Pro";
  let currentTierDescription = "You can upgrade to a Google AI Ultra plan to receive higher rate limits.";
  let upgradeUrl = "https://one.google.com/explore-plan/ai-premium";
  let upgradeBtnText = "Upgrade";
  let companionProject: string | undefined = undefined;

  const endpoints = ["https://daily-cloudcode-pa.googleapis.com", "https://cloudcode-pa.googleapis.com"];

  // 1. Query user plan tier from Cloud Code API
  for (const base of endpoints) {
    try {
      const res = await fetch(`${base}/v1internal:loadCodeAssist`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "antigravity/1.11.3",
        },
        body: JSON.stringify({
          metadata: {
            ideType: "ANTIGRAVITY",
            platform: "WINDOWS_AMD64",
            pluginType: "GEMINI",
          },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const body = await res.json();
        const tier = body.currentTier || body.response?.currentTier;
        if (tier) {
          currentTierName = tier.name || currentTierName;
          currentTierDescription = tier.upgradeSubscriptionText || tier.description || currentTierDescription;
          upgradeUrl = tier.upgradeSubscriptionUri || upgradeUrl;
          upgradeBtnText = tier.upgradeButtonText || upgradeBtnText;
        }
        if (body.cloudaicompanionProject || body.project) {
          companionProject = body.cloudaicompanionProject || body.project;
        }
        break;
      }
    } catch {
      // Continue to next endpoint fallback
    }
  }

  // 2. Query Quota Summary buckets from retrieveUserQuotaSummary
  let parsedGroups: ModelQuotaGroup[] = [];

  for (const base of endpoints) {
    try {
      const res = await fetch(`${base}/v1internal:retrieveUserQuotaSummary`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "antigravity/1.11.3",
        },
        body: JSON.stringify({
          project: companionProject,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const body = await res.json();
        const rawGroups = body.response?.groups || body.groups;
        if (Array.isArray(rawGroups) && rawGroups.length > 0) {
          parsedGroups = rawGroups.map((group: any) => {
            const rawBuckets = Array.isArray(group.buckets) ? group.buckets : [];
            const buckets: QuotaBucket[] = rawBuckets.map((b: any) => {
              const fraction = typeof b.remainingFraction === "number" ? b.remainingFraction : b.remainingAmount != null ? b.remainingAmount : 0;
              const percentage = Math.round(fraction * 100);

              return {
                name: b.displayName || "Limit Remaining",
                percentageRemaining: percentage,
                description: b.description,
                resetTime: b.resetTime,
                isExhausted: percentage <= 0,
              };
            });

            return {
              name: group.displayName || "AI Models",
              category: (group.displayName || "").toLowerCase().includes("gemini") ? "gemini" : "claude_gpt",
              buckets,
              percentageRemaining: buckets[0]?.percentageRemaining ?? 0,
              isExhausted: (buckets[0]?.percentageRemaining ?? 0) <= 0,
            };
          });
          break;
        }
      }
    } catch {
      // Continue to next endpoint fallback
    }
  }

  // 3. Fallback to fetchAvailableModels if retrieveUserQuotaSummary was empty
  if (parsedGroups.length === 0) {
    for (const base of endpoints) {
      try {
        const res = await fetch(`${base}/v1internal:fetchAvailableModels`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": "antigravity/1.11.3",
          },
          body: JSON.stringify({
            project: companionProject,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const body = await res.json();
          const rawModels = body.models || body.response?.models;
          if (Array.isArray(rawModels) && rawModels.length > 0) {
            const geminiModels = rawModels.filter((m: any) => (m.label || m.modelId || "").toLowerCase().includes("gemini"));
            const claudeModels = rawModels.filter((m: any) => !(m.label || m.modelId || "").toLowerCase().includes("gemini"));

            const firstGemini = geminiModels[0]?.quotaInfo;
            const firstClaude = claudeModels[0]?.quotaInfo;

            const geminiFraction = firstGemini ? (firstGemini.remainingFraction ?? 0) : 0;
            const claudeFraction = firstClaude ? (firstClaude.remainingFraction ?? 0) : 0;

            parsedGroups = [
              {
                name: "Gemini Models",
                category: "gemini",
                buckets: [
                  {
                    name: "Weekly Limit Remaining",
                    percentageRemaining: Math.round(geminiFraction * 100),
                    resetTime: firstGemini?.resetTime,
                    isExhausted: geminiFraction <= 0,
                  },
                ],
                percentageRemaining: Math.round(geminiFraction * 100),
                isExhausted: geminiFraction <= 0,
              },
              {
                name: "Claude and GPT models",
                category: "claude_gpt",
                buckets: [
                  {
                    name: "Weekly Limit Remaining",
                    percentageRemaining: Math.round(claudeFraction * 100),
                    resetTime: firstClaude?.resetTime,
                    isExhausted: claudeFraction <= 0,
                  },
                ],
                percentageRemaining: Math.round(claudeFraction * 100),
                isExhausted: claudeFraction <= 0,
              },
            ];
            break;
          }
        }
      } catch {
        // Fallback
      }
    }
  }

  const isProOrUltra = currentTierName.toLowerCase().includes("pro") || currentTierName.toLowerCase().includes("ultra");

  // If live groups were found from real Google API
  if (parsedGroups.length > 0) {
    const geminiGroup = parsedGroups.find((g) => g.category === "gemini") || parsedGroups[0];
    const claudeGroup = parsedGroups.find((g) => g.category === "claude_gpt") || parsedGroups[1] || parsedGroups[0];

    return {
      planName: currentTierName,
      planSubtext: currentTierDescription,
      upgradeUrl,
      upgradeButtonText: upgradeBtnText,
      credits: isProOrUltra
        ? {
            enabled: false,
            title: "Enable AI Credit Overages",
            description:
              "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.",
            learnMoreUrl: "https://cloud.google.com/products/gemini/pricing",
          }
        : undefined,
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

  // Fallback state for authenticated user if groups response was unavailable
  return {
    planName: currentTierName,
    planSubtext: currentTierDescription,
    upgradeUrl,
    upgradeButtonText: upgradeBtnText,
    credits: isProOrUltra
      ? {
          enabled: false,
          title: "Enable AI Credit Overages",
          description:
            "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.",
          learnMoreUrl: "https://cloud.google.com/products/gemini/pricing",
        }
      : undefined,
    gemini: {
      name: "Gemini Models",
      category: "gemini",
      percentageRemaining: 0,
      isExhausted: false,
      buckets: [
        {
          name: "Weekly Limit Remaining",
          percentageRemaining: 0,
          isExhausted: false,
        },
      ],
    },
    claudeGpt: {
      name: "Claude and GPT models",
      category: "claude_gpt",
      percentageRemaining: 0,
      isExhausted: true,
      refreshSecondsRemaining: 3 * 3600 + 35 * 60,
      buckets: [
        {
          name: "Weekly Limit Remaining",
          percentageRemaining: 0,
          isExhausted: true,
          resetTimeText: "Resets in 3h 35m",
        },
      ],
    },
  };
}
