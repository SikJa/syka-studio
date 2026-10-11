import { describe, expect, it } from 'vitest';
import type { HarnessInfo } from '@diffusionstudio/agent-chat';
import { DEFAULT_MODEL_VISIBILITY, hermesProvider, hermesProviderGroups, parseModelVisibility, visibleModelCatalog } from './model-visibility';
const hermes: HarnessInfo = { id:'hermes',label:'Hermes',status:'ready',defaultModel:'openai-codex:sol',models:[
  {id:'openrouter:anthropic/opus:free',label:'OpenRouter · anthropic/opus:free'},
  {id:'openai-codex:sol',label:'ChatGPT · sol'},
  {id:'custom:9router:ag/opus',label:'9router · ag/opus'},
  {id:'custom:dahl:MiniMax/M2',label:'dahl · MiniMax/M2'},
] };
describe('model catalog visibility',()=>{
  it('groups custom endpoints separately and keeps colons in model IDs',()=>{
    expect(hermesProvider(hermes.models[0]).id).toBe('openrouter');
    expect(hermesProviderGroups(hermes.models).map(g=>g.id)).toEqual(['openrouter','openai-codex','custom:9router','custom:dahl']);
  });
  it('hides OpenRouter without hiding Hermes subscription or custom routes',()=>{
    const result=visibleModelCatalog([hermes],{harnesses:{},hermesProviders:{openrouter:false}});
    expect(result[0].models.map(m=>m.id)).toEqual(hermes.models.slice(1).map(m=>m.id));
    expect(hermes.models).toHaveLength(4);
    expect(result[0].status).toBe('ready');
  });
  it('does not filter a direct provider with a similar model ID',()=>{
    const direct:HarnessInfo={id:'codex',label:'Codex',status:'ready',models:[{id:'openrouter:example',label:'Example'}]};
    expect(visibleModelCatalog([direct],{harnesses:{},hermesProviders:{openrouter:false}})[0].models).toHaveLength(1);
  });
  it('hides whole assistants, always hides disabled Muse, and allows an empty catalog',()=>{
    expect(visibleModelCatalog([hermes,{...hermes,id:'muse'}],{harnesses:{hermes:false},hermesProviders:{}})).toEqual([]);
    expect(visibleModelCatalog([{...hermes,models:[hermes.models[0]]}],{harnesses:{},hermesProviders:{openrouter:false}})[0].models).toEqual([]);
  });
  it('defaults to visible and restores every catalog when toggled back',()=>{
    expect(visibleModelCatalog([hermes],DEFAULT_MODEL_VISIBILITY)[0].models).toEqual(hermes.models);
    expect(visibleModelCatalog([hermes],{harnesses:{},hermesProviders:{openrouter:true}})[0].models).toEqual(hermes.models);
  });
  it('sanitizes persisted data while preserving new provider names',()=>{
    expect(parseModelVisibility(null)).toEqual(DEFAULT_MODEL_VISIBILITY);
    expect(parseModelVisibility({harnesses:{hermes:false,codex:'false'},hermesProviders:{future:false,other:1}})).toEqual({harnesses:{hermes:false},hermesProviders:{future:false},models:{}});
  });
  it('hides individual models per connection without affecting another route to the same model',()=>{
    const models=[{id:'claude-opus',label:'Opus'},{id:'gemini-flash',label:'Flash'}];
    const ag:HarnessInfo={id:'antigravity',label:'Antigravity',status:'ready',models};
    const direct:HarnessInfo={id:'claude',label:'Claude',status:'ready',models:[models[0]]};
    const result=visibleModelCatalog([ag,direct],{harnesses:{},hermesProviders:{},models:{antigravity:{'claude-opus':false,'gemini-flash':true}}});
    expect(result[0].models.map(m=>m.id)).toEqual(['gemini-flash']);
    expect(result[1].models.map(m=>m.id)).toEqual(['claude-opus']);
    expect(ag.models).toHaveLength(2);
  });
  it('preserves preferences for temporarily missing models and ignores malformed nested flags',()=>{
    expect(parseModelVisibility({models:{codex:{old:false,new:'false'},antigravity:[],future:{model:true}}}).models).toEqual({codex:{old:false},antigravity:{},future:{model:true}});
  });
});
