import { Component } from "solid-js";

interface AppFooterProps {}

export const AppFooter: Component<AppFooterProps> = () => {
  return (
    <footer class="border-t border-border py-8 text-center text-xs text-muted-foreground space-y-3">
      <div class="flex items-center justify-center gap-6 font-medium">
        <a href="/" class="hover:text-foreground transition-colors underline">
          Home
        </a>
        <a href="/privacy" class="hover:text-foreground transition-colors underline">
          Privacy Policy
        </a>
        <a href="/terms" class="hover:text-foreground transition-colors underline">
          Terms of Service
        </a>
      </div>
      <p class="font-medium text-foreground">GraviQuota &hyphen; Antigravity IDE Quota &amp; Rate Limit Tracker</p>
    </footer>
  );
};
