import { createSignal, Show } from "solid-js";
import { query, createAsync, useSearchParams } from "@solidjs/router";
import { AppNavbar } from "~/components/layout/app-navbar";
import { UsageCard } from "~/components/quota/usage-card";
import { SetupDrawer } from "~/components/layout/setup-drawer";
import { TokenForm } from "~/components/token/token-form";
import { toast } from "solid-sonner";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { DEFAULT_QUOTA } from "~/types/quota";
import { fetchServerQuotaData } from "~/lib/quota";
import type { QuotaData, UserSession } from "~/types/quota";

const getQuota = query((token?: string) => fetchServerQuotaData(token || undefined), "quota");

export default function Home() {
  const [searchParams] = useSearchParams();
  const [manualToken, setManualToken] = createSignal<string | null>(null);
  const [isMutating, setIsMutating] = createSignal(false);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = createSignal(false);

  // Server-rendered initial data on SSR + reactive update on manual token change
  const serverQuota = createAsync(() => getQuota(manualToken() || undefined));

  // Client override signal for instant updates from manual token / refresh
  const [clientQuota, setClientQuota] = createSignal<QuotaData | null>(null);

  // Unified single source of truth for quota data
  const currentQuota = () => clientQuota() || serverQuota() || DEFAULT_QUOTA;

  // Single source of truth for session derived directly from unified quota data
  const userSession = (): UserSession | null => {
    const user = currentQuota()?.user;
    if (!user) return null;
    return {
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
  };

  const handleLoginGoogle = () => {
    window.location.href = "/api/auth/google";
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setManualToken(null);
      setClientQuota(DEFAULT_QUOTA);

      toast.success("Signed out successfully", {
        description: "Your Google session has been terminated and session cookies have been cleared.",
      });
      await loadQuota();
    } catch (e) {
      console.error("Logout error:", e);
      toast.error("Sign out encountered an error", {
        description: "Unable to complete sign out with the server. Please clear your browser cookies if the session persists.",
      });
    }
  };

  const loadQuota = async (customToken?: string, notifyOnSuccess = false) => {
    try {
      setIsMutating(true);
      const headers: Record<string, string> = {};
      const token = customToken || manualToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/quota", { headers });
      if (res.ok) {
        const data: QuotaData = await res.json();
        setClientQuota(data);

        if (notifyOnSuccess) {
          toast.success("Quota refreshed successfully", {
            description: "Real-time rate limits and reset countdowns have been synchronized with your account.",
          });
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: Failed to load quota`);
      }
    } catch (e: any) {
      console.error("Error loading quota:", e);
      toast.error("Failed to refresh quota", {
        description: e?.message || "Unable to retrieve quota data from the server. Please verify your connection or token.",
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleApplyManualToken = async (token: string) => {
    try {
      setIsMutating(true);
      const res = await fetch("/api/quota", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: Failed to verify token`);
      }

      const data: QuotaData = await res.json();
      setManualToken(token);
      setClientQuota(data);
    } finally {
      setIsMutating(false);
    }
  };

  const handleResetQuota = () => {
    setManualToken(null);
    setClientQuota(DEFAULT_QUOTA);
    toast.info("Quota reset to default", {
      description: "Active token and session overrides were cleared. Quota view has returned to default state.",
    });
  };

  return (
    <div class="flex min-h-screen flex-col w-full bg-background text-foreground">
      <AppNavbar userSession={userSession()} isSessionLoading={isMutating()} onOpenSetupGuide={() => setIsSetupGuideOpen(true)} onLoginGoogle={handleLoginGoogle} onLogout={handleLogout} />

      <main class="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Error notification for Google OAuth */}
        <Show when={searchParams.error}>
          <Alert class="bg-error/10 text-error-foreground shadow-none">
            <AlertTitle>Configuration Notice: Google OAuth Required</AlertTitle>
            <AlertDescription>
              {searchParams.error === "missing_client_id"
                ? "GOOGLE_CLIENT_ID is not configured in your .env file or Vercel environment variables."
                : `Google OAuth returned: ${searchParams.error}. Ensure your Gmail account is added to the Test Users list in Google Cloud Console.`}
            </AlertDescription>
          </Alert>
        </Show>

        {/* Hero Section */}
        <div class="text-center mx-auto space-y-4">
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Track Antigravity <span class="text-primary underline decoration-4 underline-offset-6 decoration-secondary">Model Limits</span>
          </h1>

          <p class="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Exact UI replica of the Antigravity IDE <strong>Models &amp; Usage</strong> modal. Sign in with your Google account to check remaining rate limits and reset countdowns in real time.
          </p>
        </div>

        <div class="text-left mx-auto space-y-7">
          <UsageCard quotaData={currentQuota()} isLoading={isMutating()} onRefresh={() => loadQuota(undefined, true)} onClose={handleResetQuota} />
          <TokenForm onApplyToken={handleApplyManualToken} isLoading={isMutating()} />
        </div>
      </main>

      {/* Footer */}
      <footer class="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <p class="font-medium text-foreground">GraviQuota - Antigravity Quota Tracker</p>
      </footer>

      {/* Setup Guide Drawer */}
      <SetupDrawer open={isSetupGuideOpen()} onOpenChange={setIsSetupGuideOpen} />
    </div>
  );
}
