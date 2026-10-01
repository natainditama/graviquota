import { z } from "zod";

const envSchema = z.object({
  // -------------------------------------------------------------------------
  // Server / Environment Mode
  // -------------------------------------------------------------------------
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // -------------------------------------------------------------------------
  // Application URL & Deployment
  // -------------------------------------------------------------------------
  APP_URL: z.url("APP_URL must be a valid absolute URL").default("http://localhost:3000"),
  VERCEL_URL: z.string().optional(),

  // -------------------------------------------------------------------------
  // Google OAuth Credentials
  // -------------------------------------------------------------------------
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),

  // -------------------------------------------------------------------------
  // Session Security & Cryptography
  // -------------------------------------------------------------------------
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters").default(""),

  // -------------------------------------------------------------------------
  // Validation Control
  // -------------------------------------------------------------------------
  SKIP_ENV_VALIDATION: z.string().optional().default("false"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate and parse server runtime environment configuration
 */
export function validateServerEnvironmentConfig(): Env {
  const resolvedAppUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const values = {
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: resolvedAppUrl,
    VERCEL_URL: process.env.VERCEL_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
    SESSION_SECRET: process.env.SESSION_SECRET || "graviquota-super-secret-session-key-2026-production",
    SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
  };

  if (process.env.SKIP_ENV_VALIDATION === "true" || process.env.NODE_ENV === "test") {
    return values as Env;
  }

  const parsed = envSchema.safeParse(values);
  if (!parsed.success) {
    console.error("Invalid environment variables:\n", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables. Check the logs above.");
  }

  return parsed.data;
}

export const env = validateServerEnvironmentConfig();
export const isProduction = env.NODE_ENV === "production";
/**
 * Check if Google OAuth authentication is configured or supported in current environment
 */
export function isGoogleOAuthReady(): boolean {
  const isLocalEnv = env.APP_URL.includes("localhost") || env.APP_URL.includes("127.0.0.1");
  return isLocalEnv || Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export const isGoogleConfigured = isGoogleOAuthReady();
