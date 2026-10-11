/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { describe, expect, it } from "vitest";
import { parseOfficialAuth } from "../src/host/auth";

const fixtureToken = (exp: number) => `fixture.${Buffer.from(JSON.stringify({ exp, "https://api.openai.com/auth": { chatgpt_plan_type: "plus" } })).toString("base64url")}.fixture`;

describe("official Codex session adapter", () => {
  it("extracts only the external access token/account fields, not refresh or ID tokens", () => {
    const token = fixtureToken(Math.floor(Date.now() / 1000) + 3600);
    const result = parseOfficialAuth({ auth_mode: "chatgpt", OPENAI_API_KEY: null, tokens: { access_token: token, account_id: "fixture-account", refresh_token: "not-exposed", id_token: "not-exposed" } });
    expect(result).toEqual({ accessToken: token, chatgptAccountId: "fixture-account", chatgptPlanType: "plus" });
    expect(JSON.stringify(result)).not.toContain("not-exposed");
  });

  it("refuses API credentials and incomplete sessions", () => {
    expect(() => parseOfficialAuth({ auth_mode: "apikey", OPENAI_API_KEY: "fixture-key" })).toThrow(/API keys/);
    expect(() => parseOfficialAuth({ tokens: {} })).toThrow(/codex login/);
  });

  it("asks for official reconnection instead of attempting private refresh flows", () => {
    expect(() => parseOfficialAuth({ auth_mode: "chatgpt", tokens: { access_token: fixtureToken(1), account_id: "fixture-account" } })).toThrow(/expiró/);
  });
});
