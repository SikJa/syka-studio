export const SKILL_DRAG_TYPE = 'application/x-syka-skill';
export type SkillReference = {name:string;path:string;bundled?:boolean;scope:string};
let active:{token:string;skill:SkillReference}|undefined;
export function beginSkillDrag(transfer:DataTransfer,skill:SkillReference){
  const token=crypto.randomUUID();active={token,skill};transfer.effectAllowed='copy';
  transfer.setData(SKILL_DRAG_TYPE,token);transfer.setData('text/plain',skill.name);
}
export function readSkillDrop(transfer:DataTransfer|null){
  if(!active||transfer?.getData(SKILL_DRAG_TYPE)!==active.token)return;
  const skill=active.skill;active=undefined;return skill;
}
export function endSkillDrag(){active=undefined;}
export const skillInstruction='Leé esta skill con syka_skills y usala cuando envíe mi pedido. Respetá el alcance elegido y conservá la edición nativa y Deshacer.';
