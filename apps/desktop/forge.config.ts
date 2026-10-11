/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { arch } from 'node:os';
import { dirname, join } from 'node:path';

import type { ForgeConfig } from '@electron-forge/shared-types';
import type { MakerSquirrelConfig } from '@electron-forge/maker-squirrel';

const { version } = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));


const sign = windowsSign();

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Syka Studio',
    appBundleId: 'syka.clips.editor',
    appCategoryType: 'public.app-category.video',
    appVersion: version,
    icon: './syka-assets/icon',
    extendInfo: {
      NSMicrophoneUsageDescription: 'Syka usa el micrófono cuando iniciás un dictado o una grabación de voz.',
    },
    win32metadata: {
      CompanyName: 'Syka Studio',
      ProductName: 'Syka Studio',
      FileDescription: 'Syka Studio',
      'application-manifest': join(__dirname, 'syka-assets', 'app.manifest'),
    },
    protocols: [],
    prune: false,
    ignore: (path) =>
      path !== '' &&
      path !== '/package.json' &&
      path !== '/release.config.json' &&
      path !== '/dist' &&
      !path.startsWith('/dist/') &&
      path !== '/web' &&
      !path.startsWith('/web/'),
    // Staged by scripts/stage-{cli,runtime,docs}.mjs; end up at
    // Contents/Resources/{cli,runtime,docs}.
    extraResource: ['./cli', './runtime', './docs'],
    osxSign: process.env.SKIP_SIGN ? undefined : {},
    osxNotarize:
      process.env.APPLE_ID && process.env.APPLE_PASSWORD && process.env.APPLE_TEAM_ID
        ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        }
        : undefined,
    windowsSign: sign,
  },
  makers: [
    new MakerZIP({}, ['win32', 'darwin']),
    new MakerDMG({
      name: `Syka-Studio-${version}-${process.arch}`,
      icon: './syka-assets/icon.icns',
      overwrite: true,
    }, ['darwin']),
    new MakerSquirrel({
      name: 'SykaStudio',
      authors: 'Syka Studio',
      description: 'The professional video editor built for agents',
      exe: 'Syka Studio.exe',
      setupExe: `Syka-Studio-${process.arch}-Setup.exe`,
      setupIcon: './syka-assets/icon.ico',
      // No upstream branded installer animation.
      // Shown by Add/Remove Programs; Squirrel only takes a URL.
      // An own hosted icon URL can be added when distributing an installer.
      noMsi: true,
      windowsSign: sign,
    }),

  ],
  publishers: [], // Publishing requires a separately configured Syka release.
  hooks: {
    preMake: async () => ensure7zip(),
  },
};



function windowsSign() {
  if (process.platform !== 'win32' || process.env.SKIP_SIGN) {
    return undefined;
  }

  const {
    WINDOWS_SIGNTOOL_PATH: signToolPath,
    WINDOWS_SIGN_DLIB: dlib,
    WINDOWS_SIGN_METADATA: metadata
  } = process.env;

  if (!signToolPath || !dlib || !metadata) {
    throw new Error(
      'Windows signing needs WINDOWS_SIGNTOOL_PATH, WINDOWS_SIGN_DLIB and WINDOWS_SIGN_METADATA; set SKIP_SIGN=1 for an unsigned build.',
    );
  }

  return {
    signToolPath,
    automaticallySelectCertificate: false,
    signWithParams: ['/dlib', dlib, '/dmdf', metadata],
    timestampServer: 'http://timestamp.acs.microsoft.com',
    hashes: ['sha256'],
  } as unknown as MakerSquirrelConfig;
}

function ensure7zip() {
  if (process.platform !== 'win32') return;
  const require = createRequire(__filename);
  const winstaller = require.resolve('electron-winstaller/package.json', {
    paths: [dirname(require.resolve('@electron-forge/maker-squirrel/package.json'))],
  });
  const vendor = join(dirname(winstaller), 'vendor');
  for (const ext of ['exe', 'dll']) {
    const target = join(vendor, `7z.${ext}`);
    if (!existsSync(target)) copyFileSync(join(vendor, `7z-${arch()}.${ext}`), target);
  }
}

export default config;
