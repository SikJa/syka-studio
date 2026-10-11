import {describe,it,expect} from 'vitest';
import {readProjectSnapshot,readThreadView} from '../../web/src/mirel-chat/features/agents/agent-project-state';
describe('chat project persistence recovery',()=>{
  it('preserves real project IDs, archived projects and chat assignments',()=>{
    const saved={projects:[{id:'a',name:'Trabajo',archived:false},{id:'b',name:'Viejo',archived:true}],assignments:{chat:'b'}};
    expect(readProjectSnapshot(JSON.stringify(saved))).toEqual(saved);
    expect(readProjectSnapshot(null)).toEqual({projects:[],assignments:{}});
  });
  it('refuses malformed stored projects instead of replacing them with an empty writable catalog',()=>{
    for(const raw of ['{','null','{"projects":null,"assignments":{}}','{"projects":[],"assignments":[]}','{"projects":[],"assignments":{"chat":12}}'])expect(()=>readProjectSnapshot(raw)).toThrow();
  });
  it('normalizes damaged preferences and migrates the legacy flat-list value',()=>{
    expect(readThreadView('{"grouping":"none","collapsed":null,"pinned":[1,"a"],"sections":{"a":12,"b":"Trabajo"},"status":"bad"}')).toMatchObject({grouping:'list',collapsed:[],pinned:['a'],sections:{b:'Trabajo'},status:'active'});
    expect(readThreadView('null')).toEqual(readThreadView(null));
    expect(readThreadView('{')).toEqual(readThreadView(null));
  });
});
