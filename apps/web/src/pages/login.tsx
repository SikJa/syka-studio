/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal, Show } from 'solid-js';
import { toast } from 'somoto';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField, TextFieldInput, TextFieldLabel } from '@/components/ui/text-field';
import { DevAuthCodeInput } from '@/components/dev-auth-code-input';
import { useAuth } from '@/context/auth';
import { useFullscreenState } from '@/hooks/use-fullscreen-state';

type OAuthButtonProps = {
  icon: string;
  label: string;
  onClick: () => void;
};

function OAuthButton(props: OAuthButtonProps) {
  return (
    <Button
      variant="secondary"
      class="w-full gap-0 px-0.5"
      onClick={props.onClick}
    >
      <Icon name={props.icon} class="size-6" />
      <span class="min-w-0 flex-1 text-center">{props.label}</span>
      <span class="size-6 shrink-0" aria-hidden="true" />
    </Button>
  );
}

export function LoginPage() {
  const auth = useAuth();
  const isFullscreen = useFullscreenState();
  const [email, setEmail] = createSignal('');
  const [otpSending, setOtpSending] = createSignal(false);

  const handleOtpSubmit = async (e: SubmitEvent) => {
    e.preventDefault();

    const value = email().trim();
    if (!value) return;

    setOtpSending(true);
    const { error } = await auth.signInWithOtp(value);
    setOtpSending(false);

    if (error) {
      toast.error(error);
    } else {
      toast.success('Check your email for the login link');
    }
  };

  return (
    <div class="flex flex-col bg-background fixed inset-0 z-999">
      <Show when={!!window.desktop && !isFullscreen()}>
        <div class="absolute inset-x-0 top-0 h-10 z-20" style="-webkit-app-region: drag;" />
      </Show>
      <Show when={!window.desktop}>
        <div class="flex items-center gap-1 p-4">
          <Icon name="diffusion-logo" class="size-6" />
          <span class="text-sm font-450 text-foreground">Diffusion Studio</span>
        </div>
      </Show>

      <div class="flex flex-1 items-center justify-center pb-16">
        <div class="flex w-70 flex-col gap-3">
          <div class="flex flex-col gap-3 rounded-xl bg-accent/40 p-4">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1">
                <h2 class="text-[12px] font-450 text-foreground">
                  Sign in or sign up
                </h2>
                <p class="text-xs text-muted-foreground">
                  Choose your preferred method
                </p>
              </div>

              <div class="flex flex-col gap-3">
                <OAuthButton
                  icon="social.google"
                  label="Continue with Google"
                  onClick={() => auth.signInWithOAuth('google')}
                />
                <OAuthButton
                  icon="social.github"
                  label="Continue with GitHub"
                  onClick={() => auth.signInWithOAuth('github')}
                />
              </div>

              <div class="flex items-center justify-center gap-3">
                <div class="h-px flex-1 bg-border" />
                <span class="text-xs text-muted-foreground">or</span>
                <div class="h-px flex-1 bg-border" />
              </div>
            </div>

            <form class="flex flex-col gap-3" onSubmit={handleOtpSubmit}>
              <TextField>
                <TextFieldLabel
                  uiSize="compact"
                  class="text-xs text-muted-foreground"
                >
                  Email
                </TextFieldLabel>
                <TextFieldInput
                  uiSize="compact"
                  type="email"
                  placeholder="Enter your email"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                />
              </TextField>

              <Button
                type="submit"
                class="w-full"
                disabled={otpSending() || !email().trim()}
              >
                {otpSending() ? 'Sending...' : 'Send magic link'}
              </Button>
            </form>
          </div>

          <DevAuthCodeInput />

          <span class="px-1 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{' '}
            <a
              href="https://www.diffusion.studio/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              class="underline hover:text-foreground"
            >
              Privacy Policy
            </a>{' '}
            and{' '}
            <a
              href="https://www.diffusion.studio/legal/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              class="underline hover:text-foreground"
            >
              Terms of Service
            </a>
            .
          </span>
        </div>
      </div>
    </div>
  );
}
