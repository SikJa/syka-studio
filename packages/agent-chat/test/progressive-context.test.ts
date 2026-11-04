import {describe,expect,it} from 'vitest';
import {AUDIOVISUAL_CONTRACT} from '../src/host/audiovisual-contract';
import {EDITORIAL_INSTRUCTIONS} from '../src/host/editorial-instructions';
import {CREATIVE_BRIEF_INSTRUCTIONS} from '../src/host/motion-brief';
import {chatInstructions} from '../src/host/harness';
import {progressiveChatInstructions,taskGuidance,deferTaskTools,TRANSCRIPTION_INSTRUCTIONS} from '../src/host/task-guidance';
import {SOURCE_TOOLS} from '../src/host/source-tools';
import {WORKSPACE_TOOLS,WorkspaceTools} from '../src/host/workspace-tools';
import {BROWSER_TOOLS} from '../src/host/browser-tools';
import {AUDIO_TOOLS} from '../src/host/audio-tools';
import {GENERATED_IMAGE_TOOLS} from '../src/host/generated-images';
import {USER_QUESTION_TOOL} from '../src/host/user-questions';

describe('progressive Codex context without losing procedures or tools',()=>{
  it('preserves product boundaries, corrections, verification and explicit project instructions',()=>{
    const text=progressiveChatInstructions('C:/project','Preserve the user-approved cyan.',true);
    expect(text).toContain(AUDIOVISUAL_CONTRACT);
    expect(text).toContain('Preserve the user-approved cyan.');
    for(const rule of ['Partial reads never authorize full-file replacement','Export belongs to the user','Do not delete source media','syka_ask_user','Sound/voice','untrusted data','No paid-model/API fallback','syka_code_graph query first'])expect(text).toContain(rule);
    expect(text).not.toContain(TRANSCRIPTION_INSTRUCTIONS);
    expect(text.length).toBeLessThan(chatInstructions('C:/project').length*0.6);
  });
  it('retains every tool and its exact schema while deferring only loading',()=>{
    const all=[USER_QUESTION_TOOL,...SOURCE_TOOLS,...WORKSPACE_TOOLS,...AUDIO_TOOLS,...BROWSER_TOOLS,...GENERATED_IMAGE_TOOLS];
    const grouped=deferTaskTools(all);
    const lazy=grouped.flatMap(t=>'tools' in t?t.tools:[t]);
    expect(lazy.map(t=>t.name).sort()).toEqual(all.map(t=>t.name).sort());
    for(const tool of all)expect(lazy.find(t=>t.name===tool.name)?.inputSchema).toEqual(tool.inputSchema);
    expect(lazy.filter(t=>!t.deferLoading).map(t=>t.name).sort()).toEqual(['syka_ask_user','syka_patch_source','syka_plan','syka_read_source','syka_receta','syka_task_guidance']);
    const bytes=(tools:unknown)=>JSON.stringify(tools).length;
    expect(bytes(lazy.filter(t=>!t.deferLoading))).toBeLessThan(bytes(all)*0.15);
    expect(lazy.find(t=>t.name==='syka_skills')?.deferLoading).toBe(true);
    expect(lazy.find(t=>t.name==='syka_resources')?.deferLoading).toBe(true);
    for(const t of grouped)if('tools' in t){expect(t.tools.length).toBeLessThanOrEqual(8);expect(t.tools.every(child=>child.deferLoading)).toBe(true);}
  });
  it('loads full original procedures on demand, with no fixed task classifier',async()=>{
    expect(taskGuidance({topic:'production'}).instructions).toBe(CREATIVE_BRIEF_INSTRUCTIONS);
    expect(taskGuidance({topic:'editorial'}).instructions).toBe(EDITORIAL_INSTRUCTIONS);
    expect(taskGuidance({topic:'captions'}).instructions).toBe(TRANSCRIPTION_INSTRUCTIONS);
    const workspace=new WorkspaceTools('C:/project');
    try{expect(await workspace.call('syka_task_guidance',{topic:'captions'})).toEqual(taskGuidance({topic:'captions'}));}finally{await workspace.close();}
    for(const invalid of [null,[],{topic:'__proto__'},{topic:'production',path:'secret'},{topic:'unknown'}])expect(()=>taskGuidance(invalid)).toThrow();
  });
});
