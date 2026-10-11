/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './app'
import { initAnalytics } from './lib/analytics'
import { restoreLastRoute } from './lib/persist-route'
import { initializeAppearance } from './lib/appearance/controller'

const disposeAppearance = initializeAppearance()
if (import.meta.hot) import.meta.hot.dispose(disposeAppearance)

// Local Syka does not send crash reports or personal data to upstream services.

document.addEventListener('contextmenu', (e) => e.preventDefault())

if (window.desktop) {
  document.documentElement.dataset.platform = window.desktop.platform;

  const origRequest = FileSystemHandle.prototype.requestPermission;
  FileSystemHandle.prototype.queryPermission = async function (desc) {
    try {
      return await origRequest.call(this, desc);
    } catch {
      return 'prompt';
    }
  };

  restoreLastRoute();
}

initAnalytics()

const root = document.getElementById('root')

render(() => <App />, root!)
