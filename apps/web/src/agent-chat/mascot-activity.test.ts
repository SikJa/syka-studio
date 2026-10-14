import {describe,expect,it} from 'vitest';
import type {Item} from '@diffusionstudio/agent-chat';
import {mascotActivity,mascotTimelineTool,noticeMascotActivity} from './mascot-activity';
const user:Item={kind:'user',id:'u',text:'Editá mi video'};
const tool=(name:string,status:'running'|'done'|'failed'='running'):Extract<Item,{kind:'tool'}>=>({kind:'tool',id:name,name,title:name,status});
describe('mascot activity from real current-turn events',()=>{
  it.each([
    ['mcp__syka__media_transcribe','captions'],['syka_read_transcript','captions'],
    ['mcp__syka__syka_audio_analyze','audio'],['syka_audio_enhance','audio'],
    ['syka_edit_source','editing'],['fileChange','editing'],['capture','review'],
    ['syka_motion_review','review'],['commandExecution','thinking'],
  ])('maps %s to %s',(name,result)=>expect(mascotActivity([user,tool(name)],true,false)).toBe(result));
  it('a pending question wins over background work',()=>expect(mascotActivity([user,tool('syka_edit_source')],true,true)).toBe('question'));
  it('does not infer execution from user text or tool output',()=>expect(mascotActivity([{...user,text:'media_transcribe'}, {...tool('commandExecution'),detail:'syka_audio_analyze',output:'caption'}],true,false)).toBe('thinking'));
  it('ignores stale tools from an earlier turn',()=>expect(mascotActivity([tool('media_transcribe'),user],true,false)).toBe('thinking'));
  it('returns to generic work after the specialized tool ends',()=>expect(mascotActivity([user,tool('media_transcribe','done')],true,false)).toBe('thinking'));
  it('does not celebrate an idle or interrupted turn',()=>expect(mascotActivity([user,tool('media_transcribe','failed')],false,false)).toBe('idle'));
  it('surfaces a terminal error notice',()=>expect(mascotActivity([user,{kind:'notice',id:'n',level:'error',text:'Missing file'}],false,false)).toBe('error'));
  it('only travels for a live native edit in the current turn',()=>{
    expect(mascotTimelineTool([user,tool('mcp__syka__syka_edit_source')],true)?.id).toBe('mcp__syka__syka_edit_source');
    expect(mascotTimelineTool([tool('syka_edit_source'),user],true)).toBeUndefined();
    expect(mascotTimelineTool([user,tool('syka_edit_source','done')],true)).toBeUndefined();
    expect(mascotTimelineTool([user,tool('syka_edit_source')],false)).toBeUndefined();
    expect(mascotTimelineTool([user,tool('apply_patch')],true)).toBeUndefined();
  });
  it('gives alerts their own expression without celebrating a blocking error',()=>{
    expect(noticeMascotActivity('question')).toBe('question');
    expect(noticeMascotActivity('blocked')).toBe('error');
    expect(noticeMascotActivity('auth')).toBe('error');
    for(const kind of ['complete','export','review','transcription','download','analysis'] as const)expect(noticeMascotActivity(kind)).toBe('notification');
  });
});
