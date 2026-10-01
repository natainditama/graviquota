import { Component, createSignal, Show } from "solid-js";
import { CheckCircle2, ArrowRight, RotateCw, HelpCircle } from "lucide-solid";
import { toast } from "solid-sonner";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { TextField, TextFieldInput, TextFieldLabel, TextFieldDescription, TextFieldErrorMessage } from "~/components/ui/text-field";
import { TokenDrawer } from "~/components/token/token-drawer";

interface TokenFormProps {
  onApplyToken: (token: string) => Promise<void>;
  isLoading?: boolean;
}

export const TokenForm: Component<TokenFormProps> = (props) => {
  const [token, setToken] = createSignal("");
  const [validationError, setValidationError] = createSignal<string | null>(null);
  const [isSuccess, setIsSuccess] = createSignal(false);
  const [isDrawerOpen, setIsDrawerOpen] = createSignal(false);

  const validateTokenFormat = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) {
      return "Google Access Token is required";
    }

    if (!trimmed.startsWith("ya29.")) {
      return "Invalid format. Google OAuth access tokens must start with 'ya29.'";
    }

    if (trimmed.length < 30) {
      return "Token is too short. Please provide a complete Google access token";
    }

    return null;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const error = validateTokenFormat(token());

    if (error) {
      setValidationError(error);
      toast.error("Invalid token format", {
        description: error,
      });
      return;
    }

    try {
      setValidationError(null);
      await props.onApplyToken(token().trim());

      setIsSuccess(true);
      toast.success("Token verified successfully", {
        description: "Your Google access token has been verified and your real-time model quota data has been refreshed.",
      });
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err: any) {
      const msg = err?.message || "Token verification failed. Please check that the token is valid and active.";
      setValidationError(msg);
      toast.error("Token verification failed", {
        description: msg,
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader class="space-y-3">
          <div class="flex items-center justify-between">
            <CardTitle>Manual Google Access Token</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDrawerOpen(true)} class="gap-1.5 text-xs h-7 px-2.5">
              <HelpCircle class="size-3.5" />
              <span>Get Token</span>
            </Button>
          </div>
          <CardDescription>
            Provide an active <code class="font-mono">access_token</code> from your local Antigravity environment or OAuth session to check limits directly.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent>
            <Show
              when={!props.isLoading}
              fallback={
                <div class="space-y-1.5">
                  <Skeleton height={16} width={132} radius={4} />
                  <div class="w-full flex items-center justify-center">
                    <Skeleton height={44} width={0} radius={6} />
                  </div>
                  <Skeleton height={18} width={380} radius={4} />
                </div>
              }
            >
              <TextField validationState={validationError() ? "invalid" : "valid"}>
                <TextFieldLabel>Google Bearer Token</TextFieldLabel>
                <TextFieldInput
                  type="password"
                  placeholder="ya29.a0Ac.."
                  value={token()}
                  onInput={(e) => {
                    setToken(e.currentTarget.value);
                    if (validationError()) setValidationError(null);
                  }}
                />
                <Show when={validationError()}>
                  <TextFieldErrorMessage>{validationError()}</TextFieldErrorMessage>
                </Show>
                <Show when={!validationError()}>
                  <TextFieldDescription>Google OAuth tokens start with &ldquo;ya29.&rdquo; and verify directly against Google.</TextFieldDescription>
                </Show>
              </TextField>
            </Show>
          </CardContent>

          <CardFooter class="flex items-center justify-between">
            <Button type="submit" size="sm" disabled={props.isLoading}>
              <Show
                when={!props.isLoading}
                fallback={
                  <>
                    <RotateCw class="size-3 animate-spin" />
                    <span>Verifying...</span>
                  </>
                }
              >
                <span>Verify Token</span>
                <ArrowRight class="size-3" />
              </Show>
            </Button>

            <Show when={isSuccess()}>
              <span class="text-xs text-success-foreground flex items-center gap-1 font-medium animate-in fade-in">
                <CheckCircle2 class="size-3.5" />
                Verified &amp; Active
              </span>
            </Show>
          </CardFooter>
        </form>
      </Card>

      <TokenDrawer open={isDrawerOpen()} onOpenChange={setIsDrawerOpen} />
    </>
  );
};
