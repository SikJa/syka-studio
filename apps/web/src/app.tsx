/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Router, HashRouter, Route } from '@solidjs/router';
import { ColorModeProvider } from '@kobalte/core';
import { createEffect } from 'solid-js';
import { Toaster } from "@/components/ui/sonner";
import { AppContextMenu } from "@/components/app-context-menu";

import { AuthProvider, useAuth } from '@/context/auth';
import { PersistRoute } from '@/lib/persist-route';
import { useColorMode } from "@kobalte/core";
import { mainBridge } from "@/lib/ipc";
import { MAIN_CHANNELS } from "@desktop/main-channels";
import { EditorApi } from '@/dapi';
import { ScreenTooSmall } from '@/components/screen-too-small';
import { UnsupportedBrowser } from '@/components/unsupported-browser';
import { ProjectPage } from '@/pages/project';
import { NotFoundPage } from '@/pages/not-found';
import { DashboardPage } from '@/pages/dashboard';
import { SykaSettingsRoot } from '@/components/settings/modal';
import { DesktopNotificationBridge } from '@/components/desktop-notification-bridge';
import { AutomaticUpdateNotice } from '@/components/dashboard/update-menu';

function BootSplash() {
  const auth = useAuth();

  createEffect(() => {
    if (auth.isLoading()) return;
    document.getElementById('boot-splash')?.remove();
  });

  return null;
}

function TitleBarColorMode() {
  const { colorMode } = useColorMode();

  createEffect(() => {
    if (window.desktop?.platform === "win32") {
      mainBridge.call(MAIN_CHANNELS.WINDOW_SET_COLOR_MODE, { mode: colorMode() });
    };
  });

  return null;
}

function App() {
  const RouterComponent = window.desktop ? HashRouter : Router;
  return (
    <RouterComponent
      root={(props) => (
        <ColorModeProvider initialColorMode="dark">
          <AppContextMenu>
            <AuthProvider>
              {props.children}
              <SykaSettingsRoot />
              <DesktopNotificationBridge />
              <AutomaticUpdateNotice />
              <BootSplash />
              <EditorApi />
            </AuthProvider>
          </AppContextMenu>
          <Toaster />
          <ScreenTooSmall />
          <UnsupportedBrowser />
          <PersistRoute />
          <TitleBarColorMode />
        </ColorModeProvider>
      )}
    >
      <Route path="/" component={DashboardPage} />
      <Route path="/projects/*ref" component={ProjectPage} />
      <Route path="*404" component={NotFoundPage} />
    </RouterComponent>
  );
}

export default App;
