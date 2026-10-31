/** Project Hermes's native gateway inventory and session controls onto ACP.
 * Credentials and execution remain owned by Hermes; no profile settings are written.
 */
export const HERMES_GATEWAY_BRIDGE = String.raw`
import asyncio
import runpy
from acp.schema import SessionConfigOptionSelect, SetSessionConfigOptionResponse
from acp_adapter import gateway_server


class SykaGatewayACPAgent(gateway_server.GatewayACPAgent):
    async def _syka_options(self, session_id):
        client = await self._client()
        catalog = await client.rpc('model.options', session_id=session_id,
                                   include_unconfigured=False, refresh=False)
        info = await client.rpc('session.info', session_id=session_id)
        current_provider = catalog.get('provider')
        current_model = info.get('model') or catalog.get('model')
        from agent.reasoning_effort import route_supported_efforts
        rows, routes, levels_by_id = [], {}, {}
        current = ''
        for provider in catalog.get('providers', []):
            slug = provider.get('slug')
            if not isinstance(slug, str) or not slug:
                continue
            for model in provider.get('models', []):
                if not isinstance(model, str) or not model:
                    continue
                key = slug + ':' + model
                if key in routes:
                    continue
                routes[key] = {'provider': slug, 'model': model}
                is_current = slug == current_provider and model == current_model
                caps = (provider.get('capabilities') or {}).get(model) or {}
                levels = list(route_supported_efforts(slug, model, info.get('api_mode') if is_current else None) or []) if caps.get('reasoning') is not False else []
                levels_by_id[key] = levels
                rows.append({'value': key, 'name': str(provider.get('name') or slug) + ' · ' + model,
                             '_meta': {'syka': {'reasoningEfforts': levels}}})
                if is_current:
                    current = key
        if not rows or not current:
            raise ValueError('Hermes did not announce its current model in the native inventory')
        options = [SessionConfigOptionSelect.model_validate({
            'id': 'syka_gateway_model', 'name': 'Model', 'category': 'model', 'type': 'select',
            'currentValue': current, 'options': rows})]
        levels = levels_by_id[current]
        effort = info.get('reasoning_effort')
        if levels and effort in levels:
            options.append(SessionConfigOptionSelect.model_validate({
                'id': 'syka_gateway_reasoning', 'name': 'Reasoning effort',
                'category': 'thought_level', 'type': 'select', 'currentValue': effort,
                'options': [{'value': level, 'name': level} for level in levels]}))
        return options, routes

    async def new_session(self, cwd, mcp_servers=None, **kwargs):
        response = await super().new_session(cwd=cwd, mcp_servers=mcp_servers, **kwargs)
        response.config_options, _ = await self._syka_options(response.session_id)
        return response

    async def load_session(self, cwd, session_id, mcp_servers=None, **kwargs):
        response = await super().load_session(cwd=cwd, session_id=session_id,
                                              mcp_servers=mcp_servers, **kwargs)
        response.config_options, _ = await self._syka_options(self._aliases.get(session_id, session_id))
        return response

    async def set_config_option(self, config_id, session_id, value, **kwargs):
        if config_id not in ('syka_gateway_model', 'syka_gateway_reasoning'):
            return await super().set_config_option(config_id=config_id, session_id=session_id,
                                                    value=value, **kwargs)
        sid = self._aliases.get(session_id, session_id)
        options, routes = await self._syka_options(sid)
        option = next((o for o in options if o.id == config_id), None)
        if option is None or value not in [o.value for o in option.options]:
            raise ValueError('Requested setting was not announced by Hermes')
        if value != option.current_value:
            client = await self._client()
            operation = 'model' if config_id == 'syka_gateway_model' else 'reasoning'
            payload = routes[value] if operation == 'model' else {'effort': value}
            # Preserve native confirmation, revision fences and ambiguous-retry identity.
            result = await self._mutations.apply(client, sid, operation, payload,
                confirm=self._model_confirmer(session_id) if operation == 'model' else None)
            if result.get('status') == 'cancelled':
                raise ValueError('Model selection cancelled')
            self._snapshots[sid] = await client.rpc('session.resume', session_id=sid)
            self._mutations.acknowledge(sid, operation, payload)
            options, _ = await self._syka_options(sid)
        return SetSessionConfigOptionResponse(config_options=options)


# Keep official startup, dotenv, permissions, streaming and detach lifecycle.
gateway_server.GatewayACPAgent = SykaGatewayACPAgent
runpy.run_module('acp_adapter.entry', run_name='__main__', alter_sys=True)
`;
