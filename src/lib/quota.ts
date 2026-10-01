"use server";

import { getRequestEvent } from "solid-js/web";
import { type QuotaData, type ModelQuotaGroup, type QuotaBucket, DEFAULT_QUOTA } from "~/types/quota";
import { getSessionFromRequest } from "~/lib/cookie";
import { fetchGoogleLiveQuota, validateGoogleAccessToken } from "~/lib/auth";

export interface FetchQuotaOptions {
  request?: any;
  manualToken?: string;
}

interface LocalServerInfo {
  port: number;
  csrfToken: string;
}

/**
 * Discover locally running Google Antigravity Language Server process
 */
export async function discoverLocalAntigravityServer(): Promise<LocalServerInfo | null> {
  if (typeof process === "undefined") return null;

  // Windows discovery via PowerShell CIM query
  if (process.platform === "win32") {
    try {
      const { execSync } = await import("node:child_process");
      const psCmd = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*language_server*' -and $_.CommandLine -like '*csrf_token*' } | Select-Object -First 1 ProcessId, CommandLine | ConvertTo-Json -Compress`;
      const raw = execSync(`powershell -NoProfile -Command "${psCmd}"`, {
        encoding: "utf8",
        timeout: 4000,
        stdio: ["ignore", "pipe", "ignore"],
      });

      if (!raw || raw.trim() === "null") return null;
      const proc = JSON.parse(raw);
      if (!proc?.ProcessId || !proc?.CommandLine) return null;

      const tokenMatch = proc.CommandLine.match(/--csrf_token\s+([a-zA-Z0-9-]+)/);
      const csrfToken = tokenMatch ? tokenMatch[1] : "";
      if (!csrfToken) return null;

      const portsRaw = execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -OwningProcess ${proc.ProcessId} -State Listen | Select-Object -ExpandProperty LocalPort"`, {
        encoding: "utf8",
        timeout: 4000,
        stdio: ["ignore", "pipe", "ignore"],
      });

      const ports = portsRaw
        .trim()
        .split(/\r?\n/)
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => !isNaN(p) && p > 0);

      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      for (const port of ports) {
        try {
          const testRes = await fetch(`https://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Connect-Protocol-Version": "1",
              "X-Codeium-Csrf-Token": csrfToken,
            },
            body: "{}",
            signal: AbortSignal.timeout(1500),
          });

          if (testRes.ok) {
            return { port, csrfToken };
          }
        } catch {
          // Continue testing next listening port
        }
      }
    } catch {
      return null;
    }
  }

  // Unix discovery (macOS / Linux)
  if (process.platform === "darwin" || process.platform === "linux") {
    try {
      const { execSync } = await import("node:child_process");
      const psOut = execSync("ps aux | grep language_server", {
        encoding: "utf8",
        timeout: 3000,
        stdio: ["ignore", "pipe", "ignore"],
      });

      const lines = psOut.split("\n");
      for (const line of lines) {
        const tokenMatch = line.match(/--csrf_token[=\s]+([a-zA-Z0-9-]+)/);
        const portMatch = line.match(/--extension_server_port[=\s]+(\d+)/);

        if (tokenMatch && portMatch) {
          return {
            csrfToken: tokenMatch[1],
            port: parseInt(portMatch[1], 10),
          };
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Fetch live quota and plan info directly from local Antigravity language server
 */
export async function fetchLocalAntigravityQuota(info: LocalServerInfo): Promise<Partial<QuotaData> | null> {
  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    // 1. Fetch RetrieveUserQuotaSummary
    const quotaRes = await fetch(`https://127.0.0.1:${info.port}/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
        "X-Codeium-Csrf-Token": info.csrfToken,
      },
      body: "{}",
      signal: AbortSignal.timeout(3000),
    });

    if (!quotaRes.ok) return null;
    const quotaJson = await quotaRes.json();
    const rawGroups = quotaJson?.response?.groups || quotaJson?.groups || [];

    // 2. Fetch GetUserStatus for user profile and tier details
    let userTierName = "Google AI Pro";
    let userTierDesc = "You can upgrade to a Google AI Ultra plan to receive higher rate limits.";
    let upgradeUri = "https://antigravity.google/g1-upgrade";
    let upgradeText = "Upgrade";
    let userEmail: string | undefined;
    let userName: string | undefined;
    let profilePicture: string | undefined;

    try {
      const statusRes = await fetch(`https://127.0.0.1:${info.port}/exa.language_server_pb.LanguageServerService/GetUserStatus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
          "X-Codeium-Csrf-Token": info.csrfToken,
        },
        body: "{}",
        signal: AbortSignal.timeout(3000),
      });

      if (statusRes.ok) {
        const statusJson = await statusRes.json();
        const status = statusJson?.userStatus || statusJson;
        if (status) {
          userName = status.name;
          userEmail = status.email;
          profilePicture = status.profilePictureUrl;

          if (status.userTier) {
            userTierName = status.userTier.name || userTierName;
            userTierDesc = status.userTier.upgradeSubscriptionText || status.userTier.description || userTierDesc;
            upgradeUri = status.userTier.upgradeSubscriptionUri || upgradeUri;
          }
        }
      }
    } catch {
      // Non-fatal, use defaults
    }

    const groups: ModelQuotaGroup[] = rawGroups.map((group: any) => {
      const buckets: QuotaBucket[] = (group.buckets || []).map((b: any) => {
        const fraction = typeof b.remainingFraction === "number" ? b.remainingFraction : 0;
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

    const geminiGroup = groups.find((g) => g.category === "gemini") || groups[0];
    const claudeGroup = groups.find((g) => g.category === "claude_gpt") || groups[1] || groups[0];

    return {
      planName: userTierName,
      planSubtext: userTierDesc,
      upgradeUrl: upgradeUri,
      upgradeButtonText: upgradeText,
      credits: {
        enabled: false,
        title: "Enable AI Credit Overages",
        description:
          "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.",
        learnMoreUrl: "https://cloud.google.com/products/gemini/pricing",
      },
      gemini: {
        name: geminiGroup?.name || "Gemini Models",
        category: "gemini",
        percentageRemaining: geminiGroup?.buckets[0]?.percentageRemaining ?? 0,
        isExhausted: (geminiGroup?.buckets[0]?.percentageRemaining ?? 0) <= 0,
        buckets: geminiGroup?.buckets,
      },
      claudeGpt: {
        name: claudeGroup?.name || "Claude and GPT models",
        category: "claude_gpt",
        percentageRemaining: claudeGroup?.buckets[0]?.percentageRemaining ?? 0,
        isExhausted: (claudeGroup?.buckets[0]?.percentageRemaining ?? 0) <= 0,
        buckets: claudeGroup?.buckets,
      },
      groups,
      user: userEmail
        ? {
            email: userEmail,
            name: userName || userEmail.split("@")[0],
            picture: profilePicture,
          }
        : undefined,
      isAuthenticated: true,
    };
  } catch (err) {
    console.error("Local language server query error:", err);
    return null;
  }
}

/**
 * Single unified quota fetching service.
 */
export async function fetchUnifiedQuotaData(options: FetchQuotaOptions = {}): Promise<QuotaData> {
  const session = options.request ? getSessionFromRequest(options.request) : null;
  const manualToken = options.manualToken?.trim();

  let tokenUserEmail: string | undefined;

  // Validate manual token if provided
  if (manualToken) {
    const tokenCheck = await validateGoogleAccessToken(manualToken);
    if (!tokenCheck.valid) {
      throw new Error(tokenCheck.error || "Invalid or expired Google access token.");
    }
    tokenUserEmail = tokenCheck.email;
  }

  const effectiveToken = manualToken || session?.accessToken;

  let data: QuotaData = {
    ...DEFAULT_QUOTA,
    lastUpdated: new Date().toISOString(),
    isAuthenticated: Boolean(session || manualToken),
    user: session
      ? {
          email: session.email,
          name: session.name,
          picture: session.picture,
        }
      : tokenUserEmail
        ? {
            email: tokenUserEmail,
            name: tokenUserEmail.split("@")[0],
          }
        : null,
  };

  // 1. Try local Antigravity Language Server first (instant & exact when Antigravity is open)
  const localServerInfo = await discoverLocalAntigravityServer();
  if (localServerInfo) {
    const localData = await fetchLocalAntigravityQuota(localServerInfo);
    if (localData) {
      return {
        ...data,
        ...localData,
        lastUpdated: new Date().toISOString(),
        user: data.user || localData.user || null,
        isAuthenticated: Boolean(data.user || localData.user || session || manualToken),
      };
    }
  }

  // 2. Fallback to Google Cloud Code API via Bearer token
  if (effectiveToken) {
    try {
      const liveData = await fetchGoogleLiveQuota(effectiveToken);
      data = {
        ...data,
        ...liveData,
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("Could not query Google Cloud live quota, using fallback:", err);
    }
  }

  return data;
}

/**
 * Server function to fetch quota data during SSR and RPC calls.
 */
export async function fetchServerQuotaData(manualToken?: string): Promise<QuotaData> {
  try {
    const event = getRequestEvent();
    const request = (event as any)?.request || (event as any)?.nativeEvent?.req || (event as any)?.nativeEvent;
    return await fetchUnifiedQuotaData({ request, manualToken });
  } catch (err: any) {
    console.error("Error in fetchServerQuotaData:", err?.message || err);
    return DEFAULT_QUOTA;
  }
}
