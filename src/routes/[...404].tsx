import { Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import { ArrowLeft } from "lucide-solid";
import { AppFooter } from "~/components/layout/app-footer";
import { AppNavbar } from "~/components/layout/app-navbar";
import { Button } from "~/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";

export default function NotFound() {
  return (
    <div class="flex min-h-screen flex-col w-full bg-background text-foreground">
      <Title>404 - Page Not Found | GraviQuota</Title>
      <HttpStatusCode code={404} />
      <AppNavbar />

      <main class="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-16 space-y-8 flex flex-col justify-center">
        {/* Hero Section */}
        <div class="text-center mx-auto space-y-3">
          <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            404 <span class="text-primary">Not Found</span>
          </h1>
          <p class="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">The resource or page you requested could not be located on GraviQuota</p>
        </div>

        {/* Info Card */}
        <Card class="border-border">
          <CardHeader class="space-y-2 text-center sm:text-left">
            <CardTitle class="text-lg">Where would you like to go?</CardTitle>
            <CardDescription class="text-xs sm:text-sm leading-relaxed">
              The link you clicked may be outdated, the URL might have a typo, or the endpoint has been moved. You can return directly to your rate limit monitoring dashboard
            </CardDescription>
          </CardHeader>
          <CardFooter class="flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft class="size-3.5" />
              Go Back
            </Button>
            <a href="/">
              <Button variant="default" size="sm">
                Return to Dashboard
              </Button>
            </a>
          </CardFooter>
        </Card>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
