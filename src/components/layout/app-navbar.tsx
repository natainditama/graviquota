import { Component, Show } from "solid-js";
import { HelpCircle, LogOut, User, ChevronDown } from "lucide-solid";
import { Button, buttonVariants } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "~/components/ui/dropdown-menu";
import type { UserSession } from "~/types/quota";
import { cn } from "~/lib/utils";

interface AppNavbarProps {
  userSession: UserSession | null;
  isSessionLoading?: boolean;
  onOpenSetupGuide: () => void;
  onLoginGoogle: () => void;
  onLogout: () => void;
}

export const AppNavbar: Component<AppNavbarProps> = (props) => {
  return (
    <header class="w-full border-b border-border bg-background/20 backdrop-blur-2xl sticky top-0 z-40 transition-colors">
      <div class="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Name */}
        <div class="flex items-center gap-3">
          <span class="text-base font-bold text-foreground tracking-tight">GraviQuota</span>
        </div>

        {/* Right Actions */}
        <div class="flex items-center gap-2.5">
          <Button variant="ghost" size="sm" onClick={() => props.onOpenSetupGuide()}>
            <HelpCircle class="size-3.5" />
            <span class="hidden sm:inline">Vercel Setup</span>
          </Button>

          {/* Authentication State Handling */}
          <Show when={!props.isSessionLoading} fallback={<Skeleton height={36} width={160} radius={6} />}>
            <Show
              when={props.userSession}
              fallback={
                <Button variant="default" size="sm" onClick={() => props.onLoginGoogle()}>
                  {/* Google Colorful "G" Icon */}
                  <svg class="size-3.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.87c2.27-2.09 3.67-5.17 3.67-9.14z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.04c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.13C3.25 21.31 7.31 24 12 24z" />
                    <path fill="#FBBC05" d="M5.27 14.25c-.25-.72-.38-1.49-.38-2.25s.13-1.53.38-2.25V6.62H1.26C.46 8.23 0 10.06 0 12s.46 3.77 1.26 5.38l4.01-3.13z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.26 6.62l4.01 3.13c.95-2.85 3.6-4.96 6.73-4.96z" />
                  </svg>
                  <span>Sign in with Google</span>
                </Button>
              }
            >
              {(session) => (
                <DropdownMenu>
                  <DropdownMenuTrigger class={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-2.5")}>
                    {session().picture ? <img src={session().picture} alt={session().name} class="size-5 rounded-full ring-1 ring-border" /> : <User class="size-4 text-muted-foreground" />}
                    <span class="max-w-32 truncate">{session().name || session().email}</span>
                    <ChevronDown class="size-3.5" />
                  </DropdownMenuTrigger>

                  <DropdownMenuContent class="w-56 border-border bg-popover">
                    <DropdownMenuLabel>
                      <div class="flex flex-col space-y-1">
                        <p class="text-xs font-semibold text-popover-foreground">{session().name || "Google User"}</p>
                        <p class="text-xs text-muted-foreground truncate">{session().email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => props.onLogout()} class={cn(buttonVariants({ variant: "destructive", size: "sm" }), "w-full h-7 justify-start")}>
                      <LogOut class="size-3.5" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </Show>
          </Show>
        </div>
      </div>
    </header>
  );
};
