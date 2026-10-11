/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { toast } from "somoto";

import { track } from "@/lib/analytics";

/**
 * The asset names are version-independent (see the makers in
 * `forge.config.ts`), which is what lets GitHub's `/releases/latest/download/`
 * alias resolve to the newest build.
 */
const RELEASES = "https://github.com/diffusionstudio/editor/releases/latest/download/";

const DOWNLOADS = {
  macos: { url: `${RELEASES}Diffusion-Studio-arm64.dmg`, label: "macOS" },
  windows: { url: `${RELEASES}Diffusion-Studio-x64-Setup.exe`, label: "Windows" },
} as const;

export type DesktopAppPlatform = keyof typeof DOWNLOADS;

/** Where a download was started from, so the promos can be compared. */
export type DesktopAppDownloadSource = "canvas_banner" | "dashboard_footer" | "main_menu" | "chat_panel";

/** The platform the desktop app is built for that this browser runs on, if any. */
export function desktopAppPlatform(): DesktopAppPlatform | null {
  const uaData = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform ?? navigator.platform;
  if (/mac/i.test(platform)) return "macos";
  if (/win/i.test(platform)) return "windows";
  return null;
}

/** "macOS" or "Windows" for the promos' copy, null where there is no build. */
export function desktopAppPlatformLabel(): string | null {
  const platform = desktopAppPlatform();
  return platform ? DOWNLOADS[platform].label : null;
}

/** Button copy for the promos: names the platform when there is a build for it. */
export function desktopAppDownloadLabel(): string {
  const label = desktopAppPlatformLabel();
  return label ? `Download for ${label}` : "Download desktop app";
}

/**
 * Pulls the latest installer for this platform. GitHub serves the asset with
 * `Content-Disposition: attachment`, so this starts a download rather than
 * navigating away.
 *
 * The promos run on every platform to gauge interest, but there are only
 * macOS and Windows builds to hand out — everywhere else this explains that
 * instead.
 */
export function downloadDesktopApp(source: DesktopAppDownloadSource) {
  const platform = desktopAppPlatform();
  track("desktop_app_download", { source, supported: platform !== null, platform: platform ?? "other" });

  if (!platform) {
    toast("Available for macOS and Windows", {
      description:
        "The desktop app ships for macOS and Windows. Open Diffusion Studio on one of those to install it.",
    });
    return;
  }

  const a = document.createElement("a");
  a.href = DOWNLOADS[platform].url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
