"""Checks the isolated login adapter against the installed Hermes API.

Run with Hermes's venv Python and a generated Syka login launcher. Auth stores,
device responses and HTTP are fixtures: no account, browser login or LLM request.
"""
import base64
import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch

bridge_path = Path(sys.argv.pop(1)).resolve()
spec = importlib.util.spec_from_file_location("syka_login_under_test", bridge_path)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


def jwt(*, scope=None, expiry=None):
    claims = {"exp": time.time() + 3600 if expiry is None else expiry}
    if scope is not None:
        claims["scope"] = scope
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    return "fixture." + payload + ".fixture-signature"


class NativeHermesLoginTest(unittest.TestCase):
    def setUp(self):
        self.store = {"providers": {}, "active_provider": "existing-provider"}
        self.written = []
        self.output = io.StringIO()
        mocks = [
            patch.object(bridge.auth, "_load_auth_store", side_effect=lambda: self.store),
            patch.object(bridge.auth, "_auth_store_lock", side_effect=contextlib.nullcontext),
            patch.object(bridge.auth, "_save_auth_store", side_effect=lambda store: self.written.append(copy.deepcopy(store))),
            patch.object(bridge.auth.httpx, "Client", side_effect=AssertionError("Real HTTP forbidden")),
            patch.object(sys, "__stdout__", self.output),
        ]
        # These other official conveniences import external accounts, refresh
        # credentials or change model config. A normal Syka login uses none.
        for name in ("_update_config_for_provider", "_recover_codex_tokens_from_cli", "get_codex_auth_status", "get_provider_auth_state", "_write_shared_nous_state", "_save_codex_tokens"):
            mocks.append(patch.object(bridge.auth, name, side_effect=AssertionError("Unexpected profile/config access: " + name), create=True))
        for mock in mocks:
            mock.start()
            self.addCleanup(mock.stop)

    def test_installed_api_advertises_the_two_pure_device_flows(self):
        self.assertEqual(bridge.capabilities(), ["hermes-nous-device", "hermes-chatgpt-device"])

    def test_missing_native_api_disables_only_its_method(self):
        with patch.object(bridge.auth, "_nous_device_code_login", None):
            self.assertEqual(bridge.capabilities(), ["hermes-chatgpt-device"])

    def test_valid_existing_nous_account_skips_authorization_and_save(self):
        self.store["providers"]["nous"] = {"access_token": jwt(scope="inference:invoke")}
        with patch.object(bridge.auth, "_nous_device_code_login") as device, contextlib.redirect_stdout(io.StringIO()):
            bridge.login("hermes-nous-device")
        device.assert_not_called()
        self.assertEqual(self.written, [])

    def test_valid_existing_codex_pool_account_skips_authorization(self):
        self.store["credential_pool"] = {"openai-codex": [{"source": "manual:device_code", "access_token": jwt()}]}
        with patch.object(bridge.auth, "_codex_device_code_login") as device, contextlib.redirect_stdout(io.StringIO()):
            bridge.login("hermes-chatgpt-device")
        device.assert_not_called()
        self.assertEqual(self.written, [])

    def test_nous_login_surfaces_only_device_url_and_code_without_changing_provider(self):
        self.store["providers"]["nous"] = {"refresh_token": "expired-fixture-refresh"}
        fresh = {"access_token": jwt(scope="inference:invoke"), "scope": "inference:invoke", "refresh_token": "new-fixture-refresh"}

        def device(**kwargs):
            self.assertFalse(kwargs["open_browser"])
            self.assertEqual(kwargs["portal_base_url"], bridge.auth.PROVIDER_REGISTRY["nous"].portal_base_url)
            print("Portal: https://portal.nousresearch.com")
            print("Raw-response-fixture-must-stay-in-python")
            kwargs["on_verification"]("https://portal.nousresearch.com/device?user_code=ABCD-EFGH", "ABCD-EFGH")
            return fresh

        with patch.object(bridge.auth, "_nous_device_code_login", side_effect=device), contextlib.redirect_stdout(io.StringIO()):
            bridge.login("hermes-nous-device")
        self.assertEqual(self.output.getvalue(), "Open: https://portal.nousresearch.com/device?user_code=ABCD-EFGH\nUser code: ABCD-EFGH\n")
        self.assertEqual(len(self.written), 1)
        self.assertEqual(self.written[0]["active_provider"], "existing-provider")
        self.assertEqual(self.written[0]["providers"]["nous"], fresh)

    def test_codex_save_uses_native_pool_sync_and_preserves_independent_accounts(self):
        previous = "expired-fixture-singleton"
        fresh = {"tokens": {"access_token": jwt(), "refresh_token": "new-fixture-refresh"}, "last_refresh": "fixture-time"}
        self.store["providers"]["openai-codex"] = {"tokens": {"access_token": previous}, "label": "keep-label"}
        independent = {"source": "manual:device_code", "access_token": "different-fixture-account", "last_error_code": "keep-account-error"}
        self.store["credential_pool"] = {"openai-codex": [{"source": "device_code", "access_token": previous}, {"source": "manual:device_code", "access_token": previous}, copy.deepcopy(independent)]}
        with patch.object(bridge.auth, "_codex_device_code_login", return_value=fresh), contextlib.redirect_stdout(io.StringIO()):
            bridge.login("hermes-chatgpt-device")
        saved = self.written[0]
        self.assertEqual(saved["active_provider"], "existing-provider")
        self.assertEqual(saved["providers"]["openai-codex"]["label"], "keep-label")
        self.assertEqual(saved["providers"]["openai-codex"]["tokens"], fresh["tokens"])
        self.assertEqual(saved["credential_pool"]["openai-codex"][0]["access_token"], fresh["tokens"]["access_token"])
        self.assertEqual(saved["credential_pool"]["openai-codex"][1]["access_token"], fresh["tokens"]["access_token"])
        self.assertEqual(saved["credential_pool"]["openai-codex"][2], independent)

    def test_first_account_can_become_active_without_model_config_mutation(self):
        self.store.pop("active_provider")
        bridge.save_fresh("nous", {"access_token": jwt(scope="inference:invoke")})
        self.assertEqual(self.written[0]["active_provider"], "nous")

    def test_authorization_failure_does_not_write_an_account(self):
        with patch.object(bridge.auth, "_codex_device_code_login", side_effect=ValueError("fixture failure")):
            with self.assertRaises(ValueError):
                bridge.login("hermes-chatgpt-device")
        self.assertEqual(self.written, [])

    def test_status_rejects_expired_or_unscoped_tokens_and_other_provider_sessions(self):
        self.store["providers"]["nous"] = {"access_token": jwt(scope="profile:read")}
        self.store["providers"]["openai-codex"] = {"tokens": {"access_token": jwt(expiry=time.time() - 3600)}}
        self.assertFalse(bridge.local_status("nous"))
        self.assertFalse(bridge.local_status("openai-codex"))
        self.store["providers"]["nous"] = {"access_token": jwt(scope="inference:invoke")}
        self.assertFalse(bridge.local_status("openai-codex"))

    def test_codex_verification_filter_handles_fragmented_ansi_output_once(self):
        filtered = bridge.CodexVerificationOutput()
        for text in ["Raw-fixture-secret\nOpen \x1b[94mhttps://auth.open", "ai.com/codex/device\x1b[0m\n  2. Enter this code:\n", "\x1b[94mABCD-", "EFGH\x1b[0m\n", "Enter this code: XXXX-YYYY\n"]:
            filtered.write(text)
        self.assertEqual(self.output.getvalue(), "Open: https://auth.openai.com/codex/device\nUser code: ABCD-EFGH\n")

    def test_status_wire_contains_only_boolean_without_fixture_token(self):
        token = jwt()
        self.store["providers"]["openai-codex"] = {"tokens": {"access_token": token}}
        output = io.StringIO()
        with patch.object(sys, "argv", [str(bridge_path), "--status", "hermes-chatgpt-device"]), contextlib.redirect_stdout(output):
            bridge.main()
        self.assertEqual(json.loads(output.getvalue()), {"loggedIn": True})
        self.assertNotIn(token, output.getvalue())

    def test_unknown_method_is_rejected_before_provider_access(self):
        with self.assertRaises(ValueError):
            bridge.login("unknown-provider")
        self.assertEqual(self.written, [])


if __name__ == "__main__":
    unittest.main()
