import { Component, createSignal } from "solid-js";
import { Copy, Check, ExternalLink, X } from "lucide-solid";
import { Drawer, DrawerPortal, DrawerOverlay, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "~/components/ui/drawer";
import { Button, buttonVariants } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "solid-sonner";
import { cn } from "~/lib/utils";

interface SetupDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SetupDrawer: Component<SetupDrawerProps> = (props) => {
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
                  Google OAuth &amp; Vercel Setup Guide
                  <Badge variant="secondary" round>
                    OAuth 2.0
                  </Badge>
                </DrawerTitle>
                <DrawerDescription>Step-by-step instructions to configure Google credentials for live deployment.</DrawerDescription>
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
                  <CardTitle>1. Open Google Cloud Console</CardTitle>
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" class={cn("px-0! h-max!", buttonVariants({ variant: "link" }))}>
                    Open Console <ExternalLink class="size-3" />
                  </a>
                </div>
                <CardDescription>
                  Select or create a project in Google Cloud, then navigate to <strong>APIs &amp; Services &gt; Credentials</strong>
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Step 2 */}
            <Card>
              <CardHeader>
                <CardTitle>2. Create OAuth 2.0 Client ID (Web Application)</CardTitle>
                <CardDescription class="text-sm">
                  Click <strong>+ CREATE CREDENTIALS</strong> &gt; <strong>OAuth client ID</strong>. Select Application type: <strong>Web application</strong>.
                </CardDescription>
              </CardHeader>

              <CardContent class="space-y-2">
                <p class="font-medium text-foreground">Add to Authorized redirect URIs:</p>
                <div class="space-y-2">
                  <div class="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md border border-border font-mono text-sm">
                    <span>http://localhost:3000/api/auth/callback</span>
                    <Button variant="ghost" size="sm" onClick={() => copyText("http://localhost:3000/api/auth/callback", "local_uri")}>
                      {copiedId() === "local_uri" ? <Check class="size-3.5 text-success-foreground" /> : <Copy class="size-3.5" />}
                    </Button>
                  </div>

                  <div class="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md border border-border font-mono text-sm">
                    <span>https://your-project.vercel.app/api/auth/callback</span>
                    <Button variant="ghost" size="sm" onClick={() => copyText("https://your-project.vercel.app/api/auth/callback", "vercel_uri")}>
                      {copiedId() === "vercel_uri" ? <Check class="size-3.5 text-success-foreground" /> : <Copy class="size-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card>
              <CardHeader>
                <CardTitle>3. Configure Environment Variables (.env / Vercel)</CardTitle>
                <CardDescription>
                  Copy your Client ID and Client Secret into your local <code class="text-foreground font-mono">.env</code> or Vercel dashboard:
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-2">
                <pre class="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md border border-border font-mono text-sm">
                  {`GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com\n`}
                  {`GOOGLE_CLIENT_SECRET=GOCSPX-your-secret\n`}
                  {`APP_URL=https://your-project.vercel.app\n`}
                  {`SESSION_SECRET=minimum_32_characters_random_string\n`}
                </pre>
              </CardContent>
            </Card>

            {/* Step 4 */}
            <Card>
              <CardHeader class="flex flex-row items-center justify-start gap-3">
                <CardDescription>
                  <strong class="text-foreground">Important Note on Error 403:</strong> When your OAuth consent screen is in <em>Testing</em> status, add your Gmail account to{" "}
                  <strong class="text-foreground">OAuth consent screen &gt; Test users</strong> in Google Cloud Console to grant login access.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
};
