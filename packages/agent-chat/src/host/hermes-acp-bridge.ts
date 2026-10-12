import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/** Runs inside Hermes's own interpreter; the installed sources/profile stay intact. */
export const HERMES_ACP_BRIDGE = String.raw`
try:
    import hermes_bootstrap
    hermes_bootstrap.harden_import_path()
except ModuleNotFoundError:
    pass

import asyncio
import acp
from acp.schema import SessionConfigOptionSelect, SetSessionConfigOptionResponse
from acp_adapter.server import HermesACPAgent
from hermes_constants import parse_reasoning_effort


def supported_efforts(provider, model):
    """Use Hermes's actual transport vocabulary; unknown means no selector."""
    try:
        if provider in ('openai-codex', 'chatgpt', 'chatgpt-codex'):
            from agent.reasoning_effort import codex_supported_efforts
            return list(codex_supported_efforts(model))
        if provider in ('openrouter', 'nous'):
            from hermes_cli import models
            lookup = models.openrouter_model_reasoning_capabilities if provider == 'openrouter' else models.nous_model_reasoning_capabilities
            caps = lookup(model, allow_fetch=False)
            if caps and caps.get('supports_reasoning'):
                return list(caps.get('supported_efforts') or [])
        if provider in ('copilot', 'copilot-acp'):
            from hermes_cli.models import github_model_reasoning_efforts
            return list(github_model_reasoning_efforts(model))
    except (ImportError, AttributeError, TypeError, ValueError):
        pass
    return []


class SykaHermesACPAgent(HermesACPAgent):
    """Expose the existing Hermes reasoning API as ACP v1 thought_level."""
    def _syka_state(self, session_id):
        state = self.session_manager.get_session(session_id)
        if state is None:
            raise ValueError('Hermes session is no longer available')
        return state

    def _syka_efforts(self, state, model_id):
        provider, model = self._resolve_model_selection(model_id, getattr(state.agent, 'provider', None) or '')
        levels = [level for level in dict.fromkeys(supported_efforts(provider, model)) if parse_reasoning_effort(level) is not None]
        try:
            from agent.reasoning_effort import EFFORT_LADDER
            levels.sort(key=lambda level: EFFORT_LADDER.index(level) if level in EFFORT_LADDER else len(EFFORT_LADDER))
        except ImportError:
            pass
        return levels

    def _build_model_state(self, state):
        models = super()._build_model_state(state)
        if models is not None:
            for model in models.available_models:
                levels = self._syka_efforts(state, model.model_id)
                if levels:
                    meta = dict(model.field_meta or {})
                    meta['syka'] = {'reasoningEfforts': levels, 'defaultEffort': 'medium' if 'medium' in levels else levels[0]}
                    model.field_meta = meta
        return models

    def _syka_options(self, state, models=None):
        models = models if models is not None else self._build_model_state(state)
        if models is None or not models.available_models:
            return []
        options = [SessionConfigOptionSelect.model_validate({
            'id': 'syka_model', 'name': 'Model', 'category': 'model', 'type': 'select',
            'currentValue': models.current_model_id,
            'options': [{'value': model.model_id, 'name': model.name, '_meta': model.field_meta} for model in models.available_models],
        })]
        levels = self._syka_efforts(state, models.current_model_id)
        if levels:
            current = getattr(state.agent, 'reasoning_config', None) or {}
            effort = 'none' if current.get('enabled') is False else current.get('effort', 'medium')
            if effort not in levels:
                effort = 'medium' if 'medium' in levels else levels[0]
            options.append(SessionConfigOptionSelect.model_validate({
                'id': 'syka_reasoning', 'name': 'Reasoning effort', 'category': 'thought_level', 'type': 'select',
                'currentValue': effort, 'options': [{'value': level, 'name': level} for level in levels],
            }))
        return options

    async def new_session(self, cwd, mcp_servers=None, **kwargs):
        response = await super().new_session(cwd=cwd, mcp_servers=mcp_servers, **kwargs)
        state = self._syka_state(response.session_id)
        # Prefer a future native typed reasoning surface when Hermes adds it.
        if not any(getattr(option, 'category', None) == 'thought_level' for option in (response.config_options or [])):
            response.config_options = self._syka_options(state, response.models)
        return response

    async def load_session(self, cwd, session_id, mcp_servers=None, **kwargs):
        response = await super().load_session(cwd=cwd, session_id=session_id, mcp_servers=mcp_servers, **kwargs)
        if response is not None and not any(getattr(option, 'category', None) == 'thought_level' for option in (response.config_options or [])):
            response.config_options = self._syka_options(self._syka_state(session_id), response.models)
        return response

    async def set_config_option(self, config_id, session_id, value, **kwargs):
        if config_id not in ('syka_model', 'syka_reasoning'):
            return await super().set_config_option(config_id=config_id, session_id=session_id, value=value, **kwargs)
        state = self._syka_state(session_id)
        if config_id == 'syka_model':
            models = self._build_model_state(state)
            if models is None or value not in [model.model_id for model in models.available_models]:
                raise ValueError('The selected model is not in the Hermes session catalog')
            if value != models.current_model_id:
                await super().set_session_model(model_id=value, session_id=session_id)
            state = self._syka_state(session_id)
        else:
            models = self._build_model_state(state)
            levels = self._syka_efforts(state, models.current_model_id) if models is not None else []
            if value not in levels:
                raise ValueError('Reasoning effort is not supported by the selected Hermes model')
            # Exactly the same mutable agent setting used by Hermes's /reasoning
            # command, applied only to this ACP process/session, never config.yaml.
            state.agent.reasoning_config = parse_reasoning_effort(value)
        return SetSessionConfigOptionResponse(config_options=self._syka_options(state))


def main():
    from acp_adapter.entry import _setup_logging, _load_env
    _setup_logging()
    _load_env()
    asyncio.run(acp.run_agent(SykaHermesACPAgent(), use_unstable_protocol=True))


if __name__ == '__main__':
    main()
`;

/** Only known native Hermes venv entrypoints use the shim; arbitrary ACP stays native. */
export async function hermesAcpLaunch(command: string, args: string[], profileDir: string): Promise<{ command: string; args: string[] } | undefined> {
  const binary = basename(command).toLowerCase();
  if (!(binary === 'hermes-acp.exe' || binary === 'hermes-acp') || args.length) return undefined;
  const python = join(dirname(command), process.platform === 'win32' ? 'python.exe' : 'python');
  if (!await stat(python).then(info => info.isFile()).catch(() => false)) return undefined;
  await mkdir(profileDir, { recursive: true });
  const script = join(profileDir, 'syka-hermes-acp-v1.py');
  if (await readFile(script, 'utf8').catch(() => '') !== HERMES_ACP_BRIDGE) await writeFile(script, HERMES_ACP_BRIDGE, 'utf8');
  return { command: python, args: [script] };
}
