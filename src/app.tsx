import { MetaProvider, Title, Meta } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { Toaster } from "~/components/ui/sonner";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>GraviQuota - Antigravity Model Limit &amp; Quota Checker</Title>
          <Meta name="theme-color" content="#09090b" />
          <Meta name="description" content="Check Antigravity AI model limit usage, weekly quota, and refresh times with Google Login." />
          <div class="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-primary selection:text-primary-foreground">
            <Suspense>{props.children}</Suspense>
            <Toaster position="bottom-right" />
          </div>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
