import { Component, createSignal, createEffect, Show, For } from "solid-js";
import { RotateCw, Info, CheckCircle2 } from "lucide-solid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import { CircularProgress } from "./circular-progress";
import type { QuotaData, ModelQuotaGroup } from "~/types/quota";
import { cn } from "~/lib/utils";

interface UsageCardProps {
  quotaData: QuotaData;
  isLoading?: boolean;
  onRefresh?: () => void;
  onClose?: () => void;
}

export const UsageCard: Component<UsageCardProps> = (props) => {
  const [formattedTime, setFormattedTime] = createSignal<string>("");
  const [creditOverages, setCreditOverages] = createSignal<boolean>(false);

  createEffect(() => {
    if (props.quotaData?.lastUpdated && typeof window !== "undefined") {
      setFormattedTime(
        new Date(props.quotaData.lastUpdated).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    }
  });

  // Derive model groups to display: either from API groups array or from gemini/claudeGpt properties
  const displayGroups = (): ModelQuotaGroup[] => {
    if (props.quotaData.groups && props.quotaData.groups.length > 0) {
      return props.quotaData.groups;
    }

    return [
      {
        name: props.quotaData.gemini.name || "Gemini Models",
        category: "gemini",
        buckets: props.quotaData.gemini.buckets || [
          {
            name: "Weekly Limit Remaining",
            percentageRemaining: props.quotaData.gemini.percentageRemaining ?? 0,
            resetTimeText: props.quotaData.gemini.resetTimeText,
            isExhausted: props.quotaData.gemini.isExhausted,
          },
        ],
        percentageRemaining: props.quotaData.gemini.percentageRemaining ?? 0,
        isExhausted: props.quotaData.gemini.isExhausted,
      },
      {
        name: props.quotaData.claudeGpt.name || "Claude and GPT models",
        category: "claude_gpt",
        buckets: props.quotaData.claudeGpt.buckets || [
          {
            name: "Weekly Limit Remaining",
            percentageRemaining: props.quotaData.claudeGpt.percentageRemaining ?? 0,
            resetTimeText: props.quotaData.claudeGpt.resetTimeText,
            isExhausted: props.quotaData.claudeGpt.isExhausted,
          },
        ],
        percentageRemaining: props.quotaData.claudeGpt.percentageRemaining ?? 0,
        isExhausted: props.quotaData.claudeGpt.isExhausted,
      },
    ];
  };

  return (
    <Card>
      {/* Top Header */}
      <CardHeader class="flex flex-row items-center justify-between">
        <div class="space-y-1">
          <CardTitle>Models &amp; Usage</CardTitle>
          <CardDescription>Manage your model quota and credits.</CardDescription>
        </div>
        <Button variant="outline" size="icon" onClick={() => props.onRefresh?.()} title="Refresh quota data" disabled={props.isLoading}>
          <RotateCw class={`size-4 ${props.isLoading ? "animate-spin text-primary" : ""}`} />
        </Button>
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
          <div class="space-y-2">
            <div class="flex items-center justify-start gap-1.5 px-1">
              <span class="text-xs font-medium text-muted-foreground">Plan</span>
              <Badge variant="secondary" round>
                Active Tier
              </Badge>
            </div>

            <Card class="shadow-none border-border bg-card">
              <CardHeader class="space-y-0 p-4 flex flex-row justify-between items-center gap-4">
                <div class="flex flex-col justify-center items-start gap-1">
                  <p class="text-sm font-semibold text-card-foreground">
                    Your Plan: <span class="text-foreground font-semibold">{props.quotaData.planName}</span>
                  </p>
                  <p class="text-xs text-muted-foreground leading-relaxed">{props.quotaData.planSubtext} </p>
                  <Show when={props.quotaData.learnMoreUrl}>
                    <a href={props.quotaData.learnMoreUrl} target="_blank" rel="noopener noreferrer" class={cn(buttonVariants({ variant: "link", size: "xs" }), "h-max! p-0! underline")}>
                      Learn more
                    </a>
                  </Show>
                </div>

                <Show when={props.quotaData.upgradeUrl}>
                  <a href={props.quotaData.upgradeUrl} target="_blank" rel="noopener noreferrer" class={cn(buttonVariants({ variant: "default", size: "sm" }), "shrink-0 font-medium")}>
                    {props.quotaData.upgradeButtonText || "Upgrade"}
                  </a>
                </Show>
              </CardHeader>
            </Card>
          </div>

          {/* Model Credits Section */}
          {/* <Show when={props.quotaData.credits}>
            <div class="space-y-2">
              <div class="flex items-center justify-start gap-1 px-1">
                <span class="text-xs font-medium text-muted-foreground">Model Credits</span>
              </div>

              <Card class="shadow-none border-border bg-card">
                <CardHeader class="space-y-0 p-4 flex flex-row justify-between items-center gap-4">
                  <div class="flex flex-col justify-center items-start gap-1">
                    <span class="text-sm font-semibold text-card-foreground">{props.quotaData.credits?.title || "Enable AI Credit Overages"}</span>
                    <p class="text-xs text-muted-foreground leading-relaxed">
                      {props.quotaData.credits?.description ||
                        "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits."}{" "}
                      <a href={props.quotaData.credits?.learnMoreUrl || props.quotaData.learnMoreUrl} target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-medium">
                        Learn more
                      </a>
                    </p>
                  </div>

                  <Switch checked={creditOverages()} onChange={setCreditOverages} />
                </CardHeader>
              </Card>
            </div>
          </Show> */}

          {/* Model Quota Groups (Gemini Models, Claude and GPT models) */}
          <For each={displayGroups()}>
            {(group) => (
              <div class="space-y-2">
                <div class="flex items-center justify-start gap-1 px-1">
                  <span class="text-xs font-medium text-muted-foreground">{group.name}</span>
                  <Badge variant="ghost" class="aspect-square p-0.5!">
                    <Info class="size-3.5" />
                  </Badge>
                </div>

                <Card class="shadow-none border-border bg-card overflow-hidden divide-y divide-border">
                  <For each={group.buckets}>
                    {(bucket) => (
                      <div class="p-4 flex flex-row justify-between items-center gap-4">
                        <div class="flex flex-col justify-center items-start gap-1">
                          <span class="text-sm font-medium text-foreground">{bucket.name}</span>
                          <Show when={bucket.description || bucket.resetTimeText}>
                            <p class="text-xs text-muted-foreground leading-relaxed max-w-xl">
                              {bucket.description || (bucket.resetTimeText ? `You have used some of your limit, it will fully refresh in ${bucket.resetTimeText}.` : "")}
                            </p>
                          </Show>
                        </div>
                        <div class="flex flex-row items-center justify-center gap-3 shrink-0">
                          <span class="text-sm font-semibold text-foreground">{bucket.percentageRemaining}%</span>
                          <CircularProgress percentage={bucket.percentageRemaining} size={28} strokeWidth={3.5} />
                        </div>
                      </div>
                    )}
                  </For>
                </Card>
              </div>
            )}
          </For>

          {/* Model limits explanatory subtext */}
          <p class="text-xs text-muted-foreground px-1 leading-relaxed">
            Weekly limits reset weekly based on a rolling window. Five hour limits reset five hours after your first request. Rate limits apply across all projects.
          </p>
        </Show>
      </CardContent>

      {/* Footer Metadata */}
      <CardContent class="flex items-center justify-between px-6 pt-6 border-t border-border/50 text-xs text-muted-foreground">
        <div>
          <Show when={props.quotaData.user?.email}>
            <span class="flex items-center gap-1.5 font-medium text-foreground">
              <CheckCircle2 class="size-3.5 text-success-foreground" />
              <span>{props.quotaData.user?.email}</span>
            </span>
          </Show>
        </div>

        <div class="flex items-center gap-1">
          <span>Refreshed:</span>
          <span class="font-medium text-foreground">{formattedTime() || "Just now"}</span>
        </div>
      </CardContent>
    </Card>
  );
};
