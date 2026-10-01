import { Title } from "@solidjs/meta";
import { AppNavbar } from "~/components/layout/app-navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { AppFooter } from "~/components/layout/app-footer";

export default function TermsOfService() {
  return (
    <div class="flex min-h-screen flex-col w-full bg-background text-foreground">
      <Title>Terms of Service | GraviQuota</Title>
      <AppNavbar />

      <main class="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div class="text-center mx-auto space-y-4">
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Terms of <span class="text-primary">Service</span>
          </h1>
          <p class="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Standard terms governing the use of GraviQuota for Google Antigravity quota and rate limit inspection.
          </p>
        </div>

        {/* Disclaimer Card */}
        <Card class="border-secondary/30 bg-muted/20">
          <CardHeader class="space-y-1.5">
            <CardTitle class="text-base font-semibold">Independent Third-Party Disclaimer</CardTitle>
            <CardDescription class="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              GraviQuota is an independent open-source developer project. It is not affiliated, associated, authorized, endorsed by, or in any way officially connected with Google LLC, Alphabet Inc.,
              or any of their subsidiaries or affiliates.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Detailed Terms Sections */}
        <div class="space-y-6">
          {/* Section 1 */}
          <Card>
            <CardHeader class="space-y-1.5 pb-1.5">
              <CardTitle class="text-base font-semibold">Acceptance and Purpose</CardTitle>
              <CardDescription class="text-xs sm:text-sm text-muted-foreground">Agreement to terms upon accessing the GraviQuota web application.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>
                By accessing, browsing, or deploying GraviQuota, you agree to comply with and be bound by these Terms of Service. GraviQuota is designed specifically to provide developers with a
                real-time visual representation of their Google Antigravity IDE and Google Cloud AI rate limits, reset timers, and model quotas.
              </p>
              <p>If you do not agree to these terms, please discontinue using this software and revoke any authorization granted via Google OAuth.</p>
            </CardContent>
          </Card>

          {/* Section 2 */}
          <Card>
            <CardHeader class="space-y-1.5 pb-1.5">
              <CardTitle class="text-base font-semibold">Permitted and Acceptable Use</CardTitle>
              <CardDescription class="text-xs sm:text-sm text-muted-foreground">Guidelines for responsible usage and API etiquette.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>When utilizing GraviQuota, you agree to adhere to the following standards:</p>
              <ul class="list-disc pl-5 space-y-2">
                <li>
                  <strong class="text-foreground">Compliance with Upstream Terms:</strong> You agree to use GraviQuota in full compliance with the Google Cloud Platform Terms of Service and applicable
                  Google API policies.
                </li>
                <li>
                  <strong class="text-foreground">No Automated Abusive Traffic:</strong> You agree not to subject Google Cloud endpoints or GraviQuota deployment servers to high-frequency polling
                  scripts, distributed denial-of-service attempts, or scraping loops.
                </li>
                <li>
                  <strong class="text-foreground">Credential Security:</strong> You are solely responsible for keeping your OAuth client secrets, API credentials, and personal access tokens secure.
                  Never commit personal tokens to public repositories.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 3 */}
          <Card>
            <CardHeader class="space-y-1.5 pb-1.5">
              <CardTitle class="text-base font-semibold">Disclaimer of Warranties</CardTitle>
              <CardDescription class="text-xs sm:text-sm text-muted-foreground">Operation provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>
                GraviQuota is provided without warranty of any kind, whether express, statutory, or implied, including but not limited to the implied warranties of merchantability, fitness for a
                particular purpose, and non-infringement.
              </p>
              <p>We do not guarantee that:</p>
              <ul class="list-disc pl-5 space-y-2">
                <li>The quota calculations will always match real-time server changes instantaneously during Google upstream downtime or API modifications.</li>
                <li>The service will be uninterrupted, error-free, or entirely bug-free in every custom self-hosted environment.</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 4 */}
          <Card>
            <CardHeader class="space-y-1.5 pb-1.5">
              <CardTitle class="text-base font-semibold">Limitation of Liability</CardTitle>
              <CardDescription class="text-xs sm:text-sm text-muted-foreground">Clear liability boundaries for open-source software.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>
                To the fullest extent permitted by applicable law, in no event shall the authors, maintainers, or contributors of GraviQuota be liable for any indirect, incidental, special,
                consequential, or punitive damages, including loss of profits, data, goodwill, or service interruption arising out of or related to your use of or inability to use the software.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
