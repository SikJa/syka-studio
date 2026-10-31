import { describe, expect, it } from 'vitest';
import { geminiBridgeError } from '../src/host/gemini-bridge-error';
import { RpcError } from '../src/host/jsonrpc';

describe('Gemini bridge errors inside ACP', () => {
  it('recovers a nested provider error without leaking raw error text', () => {
    const error = new RpcError({ code: -32603, message: 'Internal error', data: { details: JSON.stringify({ error: { message: 'private prompt text', code: 'send_button_unavailable' } }) } });
    expect(geminiBridgeError(error)).toContain('botón Enviar');
    expect(geminiBridgeError(error)).not.toContain('private prompt');
  });
  it('distinguishes intervention, missing model and timeout', () => {
    expect(geminiBridgeError({ data: { message: JSON.stringify({ code: 'user_interrupted' }) } })).toContain('editar el mensaje');
    expect(geminiBridgeError({ code: 'model_unavailable' })).toContain('confirmar Argon');
    expect(geminiBridgeError({ code: 'request_timeout' })).toContain('tiempo disponible');
  });
  it('does not turn generic failures, plain text, or inherited keys into bridge errors', () => {
    expect(geminiBridgeError(Error('request_timeout API key secret'))).toBeUndefined();
    expect(geminiBridgeError({ code: 'toString' })).toBeUndefined();
    expect(geminiBridgeError({ message: '{bad json' })).toBeUndefined();
    const cycle: Record<string, unknown> = {}; cycle.data = cycle;
    expect(geminiBridgeError(cycle)).toBeUndefined();
  });
});
