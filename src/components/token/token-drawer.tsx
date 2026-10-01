import { Component, createSignal } from "solid-js";
import { Copy, Check, ExternalLink, X } from "lucide-solid";
import { Drawer, DrawerPortal, DrawerOverlay, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "~/components/ui/drawer";
import { Button, buttonVariants } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "solid-sonner";
import { cn } from "~/lib/utils";

interface TokenDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TokenDrawer: Component<TokenDrawerProps> = (props) => {
  const [copiedId, setCopiedId] = createSignal<string | null>(null);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Drawer open={props.open} onOpenChange={props.onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerContent class="max-h-[60vh] sm:max-h-[80vh]">
          {/* Drawer Header */}
          <DrawerHeader class="border-b border-border px-6">
            <div class="flex items-center justify-between">
              <div class="flex flex-col items-start gap-1.5">
                <DrawerTitle class="flex items-center gap-2">
                  Google OAuth Playground Guide
                  <Badge variant="secondary" round>
                    Bearer Token
                  </Badge>
                </DrawerTitle>
                <DrawerDescription>Generate a valid Google OAuth access token directly in your browser.</DrawerDescription>
              </div>

              <DrawerClose as="button">
                <Button variant="ghost" size="icon">
                  <X class="size-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {/* Content Body */}
          <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Step 1 */}
            <Card>
              <CardHeader>
                <div class="flex items-center justify-start gap-2">
                  <CardTitle>1. Open Google OAuth 2.0 Playground</CardTitle>
                  <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" class={cn("px-0! h-max!", buttonVariants({ variant: "link" }))}>
                    Open Playground <ExternalLink class="size-3" />
                  </a>
                </div>
                <CardDescription>
                  Visit the official <strong>Google OAuth 2.0 Playground</strong> to authorize and retrieve access tokens for your Google account.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Step 2 */}
            <Card>
              <CardHeader>
                <CardTitle>2. Select &amp; Authorize APIs (Step 1)</CardTitle>
                <CardDescription class="text-sm">
                  On the left panel under <strong>Step 1: Select &amp; authorize APIs</strong>, configure the following scopes:
                </CardDescription>
              </CardHeader>

              <CardContent class="space-y-3">
                <div class="space-y-1.5 text-sm">
                  <p class="font-medium text-foreground">1. Expand &ldquo;Google OAuth2 API v2&rdquo; and check:</p>
                  <ul class="list-disc list-inside space-y-1 text-muted-foreground font-mono text-xs pl-2">
                    <li>https://www.googleapis.com/auth/userinfo.email</li>
                    <li>https://www.googleapis.com/auth/userinfo.profile</li>
                  </ul>
                </div>

                <div class="space-y-2">
                  <p class="font-medium text-foreground text-sm">2. In &ldquo;Input your own scopes&rdquo;, enter the Cloud Platform scope:</p>
                  <div class="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md border border-border font-mono text-xs">
                    <span class="truncate">https://www.googleapis.com/auth/cloud-platform</span>
                    <Button variant="ghost" size="sm" onClick={() => copyText("https://www.googleapis.com/auth/cloud-platform", "cloud_scope")}>
                      {copiedId() === "cloud_scope" ? <Check class="size-3.5 text-success-foreground" /> : <Copy class="size-3.5" />}
                    </Button>
                  </div>
                </div>

                <div class="text-sm text-muted-foreground pt-1">
                  3. Click the blue <strong>Authorize APIs</strong> button and sign in with your Google account.
                </div>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card>
              <CardHeader>
                <CardTitle>3. Exchange Authorization Code for Tokens (Step 2)</CardTitle>
                <CardDescription>
                  In <strong>Step 2: Exchange authorization code for tokens</strong>, click the blue button labeled <strong>Exchange authorization code for tokens</strong>.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Step 4 */}
            <Card>
              <CardHeader class="space-y-2">
                <CardTitle>4. Copy Access Token into GraviQuota</CardTitle>
                <CardDescription>
                  In the right panel under <strong>Request / Response</strong>, find the <strong>Access token</strong> field starting with{" "}
                  <code class="text-foreground font-mono bg-muted/60 px-1 py-0.5 rounded">ya29...</code>. Copy the token and paste it into the manual form above.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
};
