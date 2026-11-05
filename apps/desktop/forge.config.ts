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
    // syka-asr (Parakeet) is staged by scripts/stage-asr.mjs when its toolchain is present.
    extraResource: ['./cli', './runtime', './docs', ...(existsSync('./syka-asr') ? ['./syka-asr'] : [])],
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
      // Syka's orb while Squirrel installs (it has no screens of its own).
      loadingGif: './syka-assets/install-loading.gif',
      // Shown by Add/Remove Programs; Squirrel only takes a URL: the icon in the public repository.
      iconUrl: 'https://raw.githubusercontent.com/SikJa/syka-studio/main/apps/desktop/syka-assets/icon.ico',
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
    WINDOWS_SIGN_METADATA: metadata,
    WINDOWS_SIGN_CERT_SHA1: certificateThumbprint
  } = process.env;

  if (!signToolPath || (!certificateThumbprint && (!dlib || !metadata))) {
    throw new Error(
      'Configure Artifact Signing or a certificate-store signing identity; unsigned builds are local QA only.',
    );
  }

  return {
    signToolPath,
    automaticallySelectCertificate: false,
    signWithParams: certificateThumbprint ? ['/sha1', certificateThumbprint, '/s', 'My'] : ['/dlib', dlib!, '/dmdf', metadata!],
    timestampServer: process.env.WINDOWS_TIMESTAMP_SERVER || (certificateThumbprint ? 'http://timestamp.digicert.com' : 'http://timestamp.acs.microsoft.com'),
    description: 'Syka Studio',
    website: 'https://github.com/SikJa/syka-studio',
    hashes: ['sha256'],
  } as NonNullable<ForgeConfig['packagerConfig']>['windowsSign'];
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
