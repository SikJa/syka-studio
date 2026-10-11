import {readFileSync} from 'node:fs';
export type AgentServer = {name:string;enabled:boolean;url?:string;command?:string;args?:string[]};
export function validateServers(raw:unknown):AgentServer[]{
  if(!Array.isArray(raw))throw Error('MCP debe ser una lista');
  const names=new Set<string>();
  return raw.map((s:any)=>{
    if(!s || !/^[a-z][a-z0-9_-]{0,63}$/.test(s.name)||s.name==='syka'||names.has(s.name))throw Error('Nombre MCP inválido, reservado o repetido');
    names.add(s.name);
    if(typeof s.enabled!=='boolean')throw Error('Estado MCP inválido');
    if(Boolean(s.url)===Boolean(s.command))throw Error('Elegí URL o comando MCP');
    if(s.url){const url=new URL(s.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('URL MCP inválida');}
    if(s.command && (typeof s.command!=='string'||s.command.includes('\0')))throw Error('Comando MCP inválido');
    if(s.args && (!Array.isArray(s.args)||s.args.some((a:unknown)=>typeof a!=='string')))throw Error('Argumentos MCP inválidos');
    return {name:s.name,enabled:s.enabled,...(s.url?{url:s.url}:{command:s.command,args:s.args??[]})};
  });
}
export function configuredServers(file?:string):AgentServer[]{
  if(!file)return [];
  try{return validateServers(JSON.parse(readFileSync(file,'utf8')).servers??[]);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
}
