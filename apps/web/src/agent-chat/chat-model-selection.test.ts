import { describe, expect, it } from 'vitest';
import { resolveChatModel } from './chat-model-selection';
import type { ChatSummary } from '@diffusionstudio/agent-chat';

const terra: ChatSummary = { id:'terra-chat',projectId:'p',title:'Terra',harness:'codex',model:'terra',status:'idle',createdAt:1,updatedAt:10,modelRef:{harness:'codex',model:'terra',effort:'high',fast:false} };
describe('selection isolated per chat', () => {
  it('restores Terra and its effort instead of another chat with Sol', () => {
    const sol = {...terra,id:'sol-chat',model:'sol',modelRef:{harness:'codex' as const,model:'sol',effort:'low',fast:true}};
    expect(resolveChatModel(terra)).toEqual(terra.modelRef);
    expect(resolveChatModel(sol)).toEqual(sol.modelRef);
    expect(resolveChatModel(terra)).toEqual(terra.modelRef);
  });
  it('retains a newer unsent choice only in that chat', () => {
    expect(resolveChatModel(terra,{ref:{harness:'codex',model:'terra',effort:'max'},chosenAt:11})).toMatchObject({model:'terra',effort:'max'});
    expect(resolveChatModel(terra,{ref:{harness:'codex',model:'sol'},chosenAt:9})).toEqual(terra.modelRef);
  });
  it('rejects an override for another harness and ignores inconsistent server metadata', () => {
    expect(resolveChatModel(terra,{ref:{harness:'claude',model:'opus'},chosenAt:11})).toEqual(terra.modelRef);
    expect(resolveChatModel({...terra,modelRef:{harness:'codex',model:'sol',effort:'low'}})).toEqual({harness:'codex',model:'terra'});
  });
  it('keeps legacy chats on their exact model without inventing effort or Fast', () => {
    expect(resolveChatModel({...terra,modelRef:undefined})).toEqual({harness:'codex',model:'terra'});
  });
});
