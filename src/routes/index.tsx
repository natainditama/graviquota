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
import { AppFooter } from "~/components/layout/app-footer";
import { useAuth } from "~/context/auth";

const getQuota = query((token?: string) => fetchServerQuotaData(token || undefined), "quota");

export default function Home() {
  const auth = useAuth();
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

  // Single source of truth for session derived directly from unified quota data or provider
  const userSession = (): UserSession | null => {
    const user = currentQuota()?.user;

    if (user) {
      return {
        email: user.email,
        name: user.name,
        picture: user.picture,
      };
    }
    return auth.userSession();
  };

  const handleLoginGoogle = () => {
    auth.loginGoogle();
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
      setManualToken(null);

      setClientQuota(DEFAULT_QUOTA);
      await loadQuota();
    } catch (e) {
      console.error("Logout error:", e);
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
      if (data.user) {
        auth.setUserSession({
          email: data.user.email,
          name: data.user.name,
          picture: data.user.picture,
        });
      }
    } finally {
      setIsMutating(false);
    }
  };

  const handleResetQuota = () => {
    setManualToken(null);
    setClientQuota(DEFAULT_QUOTA);
    auth.setUserSession(null);
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
            Real-time rate limit and quota monitoring for Antigravity AI models. Authenticate securely with your Google account or access token to inspect remaining limits and reset countdowns.
          </p>
        </div>

        <div class="text-left mx-auto space-y-7">
          <UsageCard quotaData={currentQuota()} isLoading={isMutating()} onRefresh={() => loadQuota(undefined, true)} onClose={handleResetQuota} />
          <TokenForm onApplyToken={handleApplyManualToken} isLoading={isMutating()} />
        </div>
      </main>

      {/* Footer */}
      <AppFooter />

      {/* Setup Guide Drawer */}
      <SetupDrawer open={isSetupGuideOpen()} onOpenChange={setIsSetupGuideOpen} />
    </div>
  );
}
