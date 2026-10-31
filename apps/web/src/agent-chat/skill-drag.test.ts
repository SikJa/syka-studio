import {it,expect} from 'vitest';
import {beginSkillDrag,readSkillDrop,endSkillDrag,SKILL_DRAG_TYPE} from './skill-drag';
it('accepts only the current local drag once; external or expired references cannot execute',()=>{
  const values=new Map<string,string>();const transfer={setData:(type:string,value:string)=>values.set(type,value),getData:(type:string)=>values.get(type)??''} as unknown as DataTransfer;
  const skill={name:'my-skill',path:'local/skill',scope:'Video completo'};
  expect(readSkillDrop(transfer)).toBeUndefined();beginSkillDrag(transfer,skill);
  expect(values.has(SKILL_DRAG_TYPE)).toBe(true);expect(readSkillDrop(transfer)).toEqual(skill);expect(readSkillDrop(transfer)).toBeUndefined();
  beginSkillDrag(transfer,skill);endSkillDrag();expect(readSkillDrop(transfer)).toBeUndefined();
});
