import { describe, expect, it } from 'vitest';
import { filterPickerModels, declaredEffortDefault } from './model-picker-options';
import { readModelPickerPreferences } from './model-picker-preferences';
describe('Studio picker catalog and presentation', () => {
  const models=[{id:'codex:same',label:'Modelo Ágil'},{id:'opencode:same',label:'Modelo Ágil'}];
  it('keeps favorites and search inside the active connection catalog',()=>{
    expect(filterPickerModels(models,'codex','agil',true,['opencode:same'])).toEqual([]);
    expect(filterPickerModels(models,'codex','agil',true,['codex:same'])).toEqual([models[0]]);
  });
  it('uses only a declared valid default from the current model',()=>{
    const levels=[{id:'low'},{id:'high'}];
    expect(declaredEffortDefault(levels,'high')).toBe('high');
    expect(declaredEffortDefault(levels,'max')).toBeUndefined();
    expect(declaredEffortDefault(levels)).toBeUndefined();
  });
  it('reads presentation without allowing a persisted account, model or effort to leak in',()=>{
    const result=readModelPickerPreferences({getItem:()=>JSON.stringify({orientation:'horizontal',material:'glass',favorites:['codex:same','codex:same',42],model:'sol',effort:'low',account:'other'})});
    expect(result).toEqual({orientation:'horizontal',material:'glass',favorites:['codex:same']});
  });
  it('recovers safely from corrupt or unavailable local storage',()=>{
    expect(readModelPickerPreferences({getItem:()=>'{'})).toEqual({orientation:'vertical',material:'solid',favorites:[]});
    expect(readModelPickerPreferences({getItem:()=>{throw Error('blocked')}})).toEqual({orientation:'vertical',material:'solid',favorites:[]});
  });
  it('reads the durable Studio envelope used across app upgrades',()=>{
    expect(readModelPickerPreferences({getItem:()=>JSON.stringify({value:{orientation:'horizontal',material:'glass',favorites:[]}})})).toEqual({orientation:'horizontal',material:'glass',favorites:[]});
  });
});
