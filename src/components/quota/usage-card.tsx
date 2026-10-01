import { Component, createSignal, onMount, onCleanup, Show } from "solid-js";
import { RotateCw, Info, CheckCircle2, Sparkles } from "lucide-solid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { CircularProgress } from "./circular-progress";
import type { QuotaData } from "~/types/quota";
import { cn } from "~/lib/utils";

interface UsageCardProps {
  quotaData: QuotaData;
  isLoading?: boolean;
  onRefresh?: () => void;
  onClose?: () => void;
}

export const UsageCard: Component<UsageCardProps> = (props) => {
  const [secondsLeft, setSecondsLeft] = createSignal(props.quotaData.claudeGpt.refreshSecondsRemaining ?? 3 * 3600 + 35 * 60);

  let timer: ReturnType<typeof setInterval>;
  onMount(() => {
    timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
  });
  onCleanup(() => clearInterval(timer));

  const formatCountdown = () => {
    const total = secondsLeft();
    if (total <= 0) return "just now";
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h} hours, ${m} minutes`;
    }
    return `${m} minutes, ${s} seconds`;
  };

  return (
    <Card>
      {/* Top Header */}
      <CardHeader class="space-y-1">
        <div class="flex items-center">
          <CardTitle>Models &amp; Usage</CardTitle>
          <Button variant="ghost" size="icon-xs" onClick={() => props.onRefresh?.()} title="Refresh quota data" disabled={props.isLoading}>
            <RotateCw class={`size-4 ${props.isLoading ? "animate-spin text-primary" : ""}`} />
          </Button>
        </div>
        <CardDescription>Manage your model quota and credits.</CardDescription>
      </CardHeader>

      <CardContent class="space-y-5">
        {/* Loading skeleton state */}
        <Show when={props.isLoading}>
          <div class="space-y-4">
            <div class="space-y-2">
              <Skeleton height={20} width={120} radius={4} />
              <div class="w-full">
                <Skeleton height={78} radius={8} />
              </div>
            </div>

            <div class="space-y-2">
              <Skeleton height={18} width={116} radius={4} />
              <div class="w-full">
                <Skeleton height={64} radius={8} />
              </div>
            </div>

            <div class="space-y-2">
              <Skeleton height={18} width={164} radius={4} />
              <div class="w-full">
                <Skeleton height={96} radius={8} />
              </div>
            </div>
          </div>
        </Show>

        <Show when={!props.isLoading}>
          {/* Plan Section */}
          <div class="space-y-3">
            <div class="flex items-center justify-start gap-1.5 px-1.5">
              <span class="text-xs font-medium text-muted-foreground">Plan</span>
              <Badge variant="secondary" round>
                Active Tier
              </Badge>
            </div>

            <Card class="shadow-none">
              <CardHeader class="space-y-0 p-4 flex flex-row justify-between items-center">
                <div class="flex flex-col justify-center items-start gap-1">
                  <p class="text-sm font-semibold text-card-foreground">
                    Your Plan: <span class="text-foreground font-medium">{props.quotaData.planName}</span>
                  </p>
                  <p class="text-xs text-muted-foreground leading-relaxed">{props.quotaData.planSubtext}</p>
                </div>
                <a href={props.quotaData.learnMoreUrl} target="_blank" rel="noopener noreferrer" class={cn(buttonVariants({ variant: "default", size: "xs" }), "shrink-0")}>
                  Learn more
                </a>
              </CardHeader>
            </Card>
          </div>

          {/* Gemini Models Section */}
          <div class="space-y-3">
            <div class="flex items-center justify-start gap-1 px-1.5">
              <span class="text-xs font-medium text-muted-foreground">Gemini Models</span>
              <Badge variant="ghost" class="aspect-square p-0.5!">
                <Info class="size-3.5" />
              </Badge>
            </div>

            <Card class="shadow-none">
              <CardHeader class="space-y-0 p-4 flex flex-row justify-between items-center">
                <span class="text-sm font-medium text-card-foreground">Weekly Limit Remaining</span>
                <div class="flex flex-row items-center justify-center gap-3">
                  <span class="text-sm font-semibold text-foreground">{props.quotaData.gemini.percentageRemaining}%</span>
                  <CircularProgress percentage={props.quotaData.gemini.percentageRemaining} size={26} strokeWidth={3.5} />
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* Claude and GPT Models Section */}
          <div class="space-y-3">
            <div class="flex items-center justify-start gap-1 px-1.5">
              <span class="text-xs font-medium text-muted-foreground">Claude and GPT models</span>
              <Badge variant="ghost" class="aspect-square p-0.5!">
                <Info class="size-3.5" />
              </Badge>
            </div>

            <Card class="shadow-none">
              <CardHeader class="space-y-0 p-4 flex flex-row justify-between items-center">
                <div class="flex flex-col justify-center items-start gap-1">
                  <span class="text-sm font-medium text-card-foreground">Weekly Limit Remaining</span>
                  <Show when={props.quotaData.claudeGpt.isExhausted}>
                    <p class="text-xs text-muted-foreground leading-relaxed max-w-xl">
                      You have hit your weekly limit, it refreshes in <span class="text-foreground font-medium inline-flex items-center gap-1 leading-relaxed">{formatCountdown()}</span>. If on a
                      supported paid plan, you can use AI credits in the interim or upgrade to a higher tier.
                    </p>
                  </Show>
                </div>
                <div class="flex flex-row items-center justify-center gap-3">
                  <span class="text-sm font-semibold text-foreground">{props.quotaData.claudeGpt.percentageRemaining}%</span>
                  <CircularProgress percentage={props.quotaData.claudeGpt.percentageRemaining} size={26} strokeWidth={3.5} />
                </div>
              </CardHeader>
            </Card>
          </div>
        </Show>
      </CardContent>

      {/* Footer Metadata */}
      <CardContent class="flex items-center justify-between px-7">
        <Show
          when={props.quotaData.isDemo}
          fallback={
            <span class="flex items-center gap-1 text-sm text-success-foreground">
              <CheckCircle2 class="size-3.5" />
              <span>{props.quotaData.user?.email ?? "Connected"}</span>
            </span>
          }
        >
          <div class="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles class="size-3.5" />
            <span>Preview Mode</span>
          </div>
        </Show>
        <div class="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Refreshed:</span>
          <span>
            {new Date(props.quotaData.lastUpdated).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
