export interface QuotaBucket {
  name: string;
  percentageRemaining: number;
  description?: string;
  resetTimeText?: string;
  resetTime?: string;
  isExhausted: boolean;
}

export interface ModelQuotaGroup {
  name: string;
  category: "gemini" | "claude_gpt" | string;
  buckets: QuotaBucket[];
  percentageRemaining?: number;
  isExhausted?: boolean;
}

export interface ModelQuota {
  name: string;
  category: "gemini" | "claude_gpt";
  percentageRemaining: number;
  totalLimit?: string;
  isExhausted: boolean;
  refreshSecondsRemaining?: number;
  resetTimeText?: string;
  infoNote?: string;
  buckets?: QuotaBucket[];
}

export interface UserSession {
  email: string;
  name: string;
  picture?: string;
  accessToken?: string;
  expiresAt?: number;
}

export interface QuotaCredits {
  enabled: boolean;
  title: string;
  description: string;
  learnMoreUrl?: string;
}

export interface QuotaData {
  planName: string;
  planSubtext: string;
  learnMoreUrl: string;
  upgradeUrl?: string;
  upgradeButtonText?: string;
  credits?: QuotaCredits;
  gemini: ModelQuota;
  claudeGpt: ModelQuota;
  groups?: ModelQuotaGroup[];
  lastUpdated: string;
  isAuthenticated?: boolean;
  user?: {
    email: string;
    name: string;
    picture?: string;
  } | null;
}

export const DEFAULT_QUOTA: QuotaData = {
  planName: "Antigravity Starter Quota",
  planSubtext: "This account is ineligible for higher rate limits through a Google AI plan at this time.",
  learnMoreUrl: "https://cloud.google.com/products/gemini/pricing",
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
  lastUpdated: "2026-01-01T00:00:00.000Z",
  isAuthenticated: false,
  user: null,
};
