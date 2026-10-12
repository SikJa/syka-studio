"""No-network checks against an installed Hermes API/interpreter.

Run with Hermes's venv Python and the generated Syka launcher path. No account,
model request, terminal tool, user configuration or credential is involved.
"""
import asyncio
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

bridge_path = Path(sys.argv.pop(1)).resolve()
spec = importlib.util.spec_from_file_location("syka_bridge_under_test", bridge_path)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

from acp.schema import ModelInfo, SessionModelState
from acp_adapter.server import HermesACPAgent
from agent.reasoning_effort import codex_supported_efforts


class NativeHermesReasoningTest(unittest.TestCase):
    def setUp(self):
        self.state = SimpleNamespace(model="gpt-5.6-sol", cwd=str(bridge_path.parent), agent=SimpleNamespace(provider="openai-codex", reasoning_config=None))
        self.agent = object.__new__(bridge.SykaHermesACPAgent)
        self.agent.session_manager = SimpleNamespace(get_session=lambda session_id: self.state if session_id == "test-session" else None)
        self.catalog = SessionModelState(current_model_id="openai-codex:gpt-5.6-sol", available_models=[ModelInfo(model_id="openai-codex:gpt-5.6-sol", name="ChatGPT or Codex Subscription · gpt-5.6-sol")])
        self.base_catalog = patch.object(HermesACPAgent, "_build_model_state", return_value=self.catalog)
        self.base_catalog.start()
        self.addCleanup(self.base_catalog.stop)

    def test_announces_only_the_native_wire_levels(self):
        models = self.agent._build_model_state(self.state)
        self.assertEqual(models.available_models[0].field_meta["syka"]["reasoningEfforts"], list(codex_supported_efforts("gpt-5.6-sol")))
        self.assertNotIn("ultra", models.available_models[0].field_meta["syka"]["reasoningEfforts"])

    def test_updates_the_actual_agent_reasoning_setting(self):
        response = asyncio.run(self.agent.set_config_option(config_id="syka_reasoning", session_id="test-session", value="high"))
        self.assertEqual(self.state.agent.reasoning_config, {"enabled": True, "effort": "high"})
        thought = next(option for option in response.config_options if option.category == "thought_level")
        self.assertEqual(thought.current_value, "high")

    def test_disables_reasoning_with_the_native_none_semantics(self):
        asyncio.run(self.agent.set_config_option(config_id="syka_reasoning", session_id="test-session", value="none"))
        self.assertEqual(self.state.agent.reasoning_config, {"enabled": False})

    def test_rejects_unadvertised_levels_without_changing_the_agent(self):
        with self.assertRaises(ValueError):
            asyncio.run(self.agent.set_config_option(config_id="syka_reasoning", session_id="test-session", value="ultra"))
        self.assertIsNone(self.state.agent.reasoning_config)

    def test_unknown_provider_does_not_get_invented_levels(self):
        self.assertEqual(bridge.supported_efforts("unknown-provider", "gpt-5.6-sol"), [])

    def test_rejects_a_model_not_in_the_native_catalog(self):
        with patch.object(HermesACPAgent, "set_session_model") as switch:
            with self.assertRaises(ValueError):
                asyncio.run(self.agent.set_config_option(config_id="syka_model", session_id="test-session", value="unlisted"))
            switch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
