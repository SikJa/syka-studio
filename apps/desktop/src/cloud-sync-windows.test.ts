/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { describe, expect, it } from "vitest";

import { dropboxRoots, isUnder, windowsCloudSyncKind } from "./cloud-sync-windows";

const home = "C:\\Users\\Example";

describe("isUnder", () => {
  it("compares the way Windows does: no case, whole segments", () => {
    expect(isUnder("c:\\users\\Example\\OneDrive\\Videos\\clip", "C:\\Users\\Example\\OneDrive")).toBe(true);
    expect(isUnder("C:\\Users\\Example\\OneDrive", "C:\\Users\\Example\\OneDrive\\")).toBe(true);
    expect(isUnder("C:\\Users\\Example\\OneDrive-old\\clip", "C:\\Users\\Example\\OneDrive")).toBe(false);
  });
});

describe("dropboxRoots", () => {
  it("reads every linked account's folder", () => {
    const info = JSON.stringify({
      personal: { path: "D:\\Dropbox", host: 1 },
      business: { path: "D:\\Dropbox (Acme)", host: 2 },
    });
    expect(dropboxRoots(info)).toEqual(["D:\\Dropbox", "D:\\Dropbox (Acme)"]);
  });

  it("finds nothing in a file it cannot read", () => {
    expect(dropboxRoots("{ not json")).toEqual([]);
    expect(dropboxRoots("null")).toEqual([]);
    expect(dropboxRoots('{"personal":{}}')).toEqual([]);
  });
});

describe("windowsCloudSyncKind", () => {
  // No LOCALAPPDATA: nothing is read from disk, only the fixed locations apply.
  const env = { OneDrive: "C:\\Users\\Example\\OneDrive" };

  it("names the service a folder sits under", async () => {
    expect(await windowsCloudSyncKind("C:\\Users\\Example\\OneDrive\\Projects\\a", home, env)).toBe("OneDrive");
    expect(await windowsCloudSyncKind("C:\\Users\\Example\\Dropbox\\a", home, env)).toBe("Dropbox");
    expect(await windowsCloudSyncKind("C:\\Users\\Example\\iCloudDrive\\a", home, env)).toBe("iCloud Drive");
  });

  it("leaves plain local disk alone", async () => {
    expect(await windowsCloudSyncKind("C:\\Users\\Example\\Videos\\a", home, env)).toBeNull();
    expect(await windowsCloudSyncKind("G:\\My Drive\\a", home, env)).toBeNull();
  });
});
