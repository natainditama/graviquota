import { Title } from "@solidjs/meta";
import { AppFooter } from "~/components/layout/app-footer";
import { AppNavbar } from "~/components/layout/app-navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div class="flex min-h-screen flex-col w-full bg-background text-foreground">
      <Title>Privacy Policy | GraviQuota</Title>
      <AppNavbar />

      <main class="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div class="text-center mx-auto space-y-4">
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Privacy <span class="text-primary">Policy</span>
          </h1>
          <p class="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Transparent, zero-data-retention privacy standards designed for developers and security-conscious individuals.
          </p>
        </div>

        {/* Summary Card */}
        <Card class="border-primary/20 bg-primary/5">
          <CardHeader class="space-y-0">
            <CardDescription class="text-xs sm:text-sm text-foreground/80 leading-relaxed">
              GraviQuota operates on a <strong>zero-knowledge, stateless architecture</strong>. We do not maintain a user database, we do not track or sell your browsing history, and we never log or
              persist your Google credentials or OAuth tokens on any remote database.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Detailed Sections */}
        <div class="space-y-6">
          {/* Section 1 */}
          <Card>
            <CardHeader class="space-y-1.5 pb-1.5">
              <CardTitle class="text-base font-semibold">Information We Access</CardTitle>
              <CardDescription class="text-xs sm:text-sm text-muted-foreground">Detailed disclosure of parameters and credentials utilized during session execution.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>When you interact with GraviQuota, only the minimal data strictly necessary to display your quota metrics is handled:</p>
              <ul class="list-disc pl-5 space-y-2">
                <li>
                  <strong class="text-foreground">Google OAuth Profile (Read-Only):</strong> If you choose to log in using Google OAuth 2.0, we receive your basic public identity (display name, email
                  address, and profile avatar) along with a temporary access token.
                </li>
                <li>
                  <strong class="text-foreground">Local Antigravity Credentials:</strong> In local desktop or self-hosted CLI modes, GraviQuota inspects your local machine's Antigravity configuration
                  to detect local credentials. This information never leaves your machine.
                </li>
                <li>
                  <strong class="text-foreground">Manual Bearer Tokens:</strong> If you paste an OAuth Playground token directly, it is held strictly in temporary client-side state for your current
                  browser tab.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 2 */}
          <Card>
            <CardHeader class="space-y-1.5 pb-1.5">
              <CardTitle class="text-base font-semibold">How We Use and Transmit Data</CardTitle>
              <CardDescription class="text-xs sm:text-sm text-muted-foreground">End-to-end data flow between your browser and Google Cloud API endpoints.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>Your authentication tokens are used exclusively to make direct, authenticated requests to Google's official endpoints:</p>
              <ul class="list-disc pl-5 space-y-2">
                <li>
                  <strong class="text-foreground">Quota Verification:</strong> Tokens are sent to Google Cloud Platform APIs to calculate your remaining model quota percentages, tier status, and reset
                  timers.
                </li>
                <li>
                  <strong class="text-foreground">No External Telemetry:</strong> We do not embed third-party tracking scripts, analytics cookies, or behavioral advertising pixels.
                </li>
                <li>
                  <strong class="text-foreground">No Token Storage:</strong> Our servers never store access tokens in permanent files or databases.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 3 */}
          <Card>
            <CardHeader class="space-y-1.5 pb-1.5">
              <CardTitle class="text-base font-semibold">Cookie &amp; Session Management</CardTitle>
              <CardDescription class="text-xs sm:text-sm text-muted-foreground">Technical overview of secure session storage mechanisms.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>
                When you authenticate via Google OAuth, the session token is preserved inside an encrypted, signed HTTP-only cookie (
                <code class="bg-muted/60 px-1 py-0.5 rounded text-foreground font-mono">graviquota_session</code>):
              </p>
              <ul class="list-disc pl-5 space-y-2">
                <li>
                  <strong class="text-foreground">HttpOnly &amp; SameSite:</strong> The cookie cannot be accessed by client-side JavaScript, guarding against cross-site scripting (XSS) vectors.
                </li>
                <li>
                  <strong class="text-foreground">Immediate Revocation:</strong> Clicking <strong>Sign Out</strong> in the top navigation immediately issues a set-cookie expiration header, permanently
                  purging the session cookie from your browser.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 4 */}
          <Card>
            <CardHeader class="space-y-1.5 pb-1.5">
              <CardTitle class="text-base font-semibold">Revoking Authorization</CardTitle>
              <CardDescription class="text-xs sm:text-sm text-muted-foreground">How you retain full control over your Google Account permissions at all times.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>You have the unilateral right to disconnect GraviQuota from your Google Account at any moment without contacting us:</p>
              <ol class="list-decimal pl-5 space-y-2">
                <li>
                  Visit your official Google Account Permissions dashboard at{" "}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary hover:underline inline-flex items-center gap-1 font-medium underline"
                  >
                    Google Security Settings
                  </a>
                  .
                </li>
                <li>Locate the application entry matching your registered OAuth Client ID.</li>
                <li>
                  Click <strong>Remove Access</strong> to immediately terminate all active tokens.
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
