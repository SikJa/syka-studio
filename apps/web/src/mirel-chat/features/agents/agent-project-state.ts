export type ChatProject = {id:string;name:string;archived:boolean};
export type ProjectSnapshot = {projects:ChatProject[];assignments:Record<string,string>};
export function readProjectSnapshot(raw:string|null):ProjectSnapshot {
  if(raw===null)return {projects:[],assignments:{}};
  const value=JSON.parse(raw);
  if(!value||!Array.isArray(value.projects)||!value.assignments||typeof value.assignments!=='object'||Array.isArray(value.assignments)
    ||value.projects.some((project:ChatProject)=>!project||typeof project.id!=='string'||typeof project.name!=='string'||typeof project.archived!=='boolean')
    ||Object.values(value.assignments).some(id=>typeof id!=='string'))throw Error('Los proyectos guardados tienen un formato inválido. Se conservaron los datos originales.');
  return value;
}
export function readThreadView(raw:string|null) {
  const defaults={grouping:'project',order:'updated',inbox:true,status:'active',collapsed:[] as string[],pinned:[] as string[],sections:{} as Record<string,string>};
  let saved;try{saved=JSON.parse(raw??'{}');}catch{return defaults;}
  if(!saved||typeof saved!=='object')return defaults;
  const strings=(value:unknown):string[]=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];
  return {...defaults,grouping:saved.grouping==='list'||saved.grouping==='none'?'list':'project',order:['updated','oldest','name'].includes(saved.order)?saved.order:defaults.order,
    status:['all','active','archived'].includes(saved.status)?saved.status:defaults.status,inbox:typeof saved.inbox==='boolean'?saved.inbox:true,
    collapsed:strings(saved.collapsed),pinned:strings(saved.pinned),sections:saved.sections&&typeof saved.sections==='object'?Object.fromEntries(Object.entries(saved.sections).filter((entry):entry is [string,string]=>typeof entry[1]==='string')):{}};
}
