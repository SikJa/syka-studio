import { isPackagedBuild } from './app-mode';
import {app} from 'electron';
import {basename,dirname,join} from 'node:path';
import {mkdir,readFile,writeFile,cp,readdir,lstat,realpath,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {configuredServers,validateServers} from '../../../packages/agent-chat/src/host/agent-config';
import {MAIN_CHANNELS} from './main-channels';
import type {mainBridge} from './main-manager';
import {localToolPath} from './syka-dependencies';
import {recipeFormat, type RecipeFormat} from '../../../packages/agent-chat/src/skill-metadata';
import {writeFileAtomic} from './atomic';
const root=()=>process.env.SYKA_RUNTIME_ROOT||app.getPath('userData');

/** Only remove a directory reserved by this call, and verify its physical parent. */
async function createSkillFolder(skillsRoot:string,name:string,build:(target:string)=>Promise<void>) {
  const target=join(skillsRoot,name);
  await mkdir(target); // Existing workflows, including concurrent imports, always win.
  try { await build(target); }
  catch(error) {
    const physicalRoot=await realpath(skillsRoot);
    const physicalTarget=await realpath(target);
    if (!(await lstat(target)).isSymbolicLink() && dirname(physicalTarget)===physicalRoot) {
      await rm(physicalTarget,{recursive:true,force:true});
    }
    throw error;
  }
}
export function registerSykaAgentSettings(bridge:typeof mainBridge){
  bridge.handle(MAIN_CHANNELS.SYKA_AGENT_SETTINGS,async req=>{
    const file=join(root(),'agent-settings.json');const skillsRoot=join(root(),'codex-runtime','profile','skills');
    await mkdir(skillsRoot,{recursive:true});
    if(req.action==='save-mcp'){
      const servers=validateServers(req.servers);await writeFileAtomic(file,JSON.stringify({version:1,servers},null,2));
    }else if(req.action==='import-skill'){
      if(!req.source)throw Error('Seleccioná la carpeta de una skill');
      const sourceDir=req.source;
      const name=req.name||basename(req.source);if(!/^[a-zA-Z0-9_-]{1,80}$/.test(name))throw Error('Nombre de skill inválido');
      const source=await lstat(req.source);if(!source.isDirectory()||source.isSymbolicLink())throw Error('Se requiere una carpeta real');
      const skillPath=join(req.source,'SKILL.md');const skillFile=await lstat(skillPath);
      if(!skillFile.isFile()||skillFile.isSymbolicLink())throw Error('SKILL.md debe ser un archivo real');
      const instructions=await readFile(skillPath,'utf8');if(!instructions.trim())throw Error('Falta SKILL.md');
      await createSkillFolder(skillsRoot,name,async target=>{
        try {
          for(const entry of await readdir(sourceDir)) {
            if(entry==='SKILL.md')continue;
            await cp(join(sourceDir,entry),join(target,entry),{recursive:true,force:false,errorOnExist:true,filter:async path=>!(await lstat(path)).isSymbolicLink()&&!['node_modules','.git'].includes(basename(path))});
          }
          // Publish the catalog marker only after all companion files are present.
          await writeFile(join(target,'SKILL.md'),instructions,{flag:'wx'});
        } catch(e) { throw Error('No se completó la importación: '+String(e)); }
      });
    }else if(req.action==='create-skill'){
      if(!req.name||!/^[a-zA-Z0-9_-]{1,80}$/.test(req.name)||!req.content?.trim())throw Error('Nombre e instrucciones requeridos');
      const content=req.content.startsWith('---')?req.content:'---\nname: '+req.name+'\ndescription: Flujo local de Syka '+req.name+'\n---\n\n'+req.content;
      await createSkillFolder(skillsRoot,req.name,folder=>writeFile(join(folder,'SKILL.md'),content,{flag:'wx'}));
     }else if(req.action==='save-skill'){
      if(!req.name||!/^[a-zA-Z0-9_-]{1,80}$/.test(req.name)||!req.content?.trim())throw Error('Nombre e instrucciones requeridos');
      const path=join(skillsRoot,req.name,'SKILL.md');const previous=await readFile(path,'utf8');
      if(req.revision!==createHash('sha256').update(previous).digest('hex'))throw Error('La skill cambió. Volvé a leerla antes de guardar');
      const backups=join(root(),'skill-history');await mkdir(backups,{recursive:true});await writeFile(join(backups,req.name+'-'+randomUUID()+'.md'),previous,{flag:'wx'});
      await writeFileAtomic(path,req.content);
    }else if(req.action==='read-skill'){
      if(!req.name||!/^[a-zA-Z0-9_-]{1,80}$/.test(req.name))throw Error('Nombre inválido');
      const content=await readFile(join(skillsRoot,req.name,'SKILL.md'),'utf8');return {servers:configuredServers(file),skills:[],skillsRoot,content,revision:createHash('sha256').update(content).digest('hex'),ffmpegPath:ffmpegPath()};
    }else if(req.action!=='get')throw Error('Acción desconocida');
    const skills:{name:string;path:string;description:string;bundled?:boolean;format?:RecipeFormat}[]=[];
    for(const entry of await readdir(skillsRoot,{withFileTypes:true})){
      if(!entry.isDirectory())continue;
      try {
        const content=await readFile(join(skillsRoot,entry.name,'SKILL.md'),'utf8');
        skills.push({name:entry.name,path:join(skillsRoot,entry.name),description:content.slice(0,300),format:recipeFormat(content)});
      }catch{}
    }
    const bundledRoot=isPackagedBuild()?join(process.resourcesPath,'docs','skills'):join(app.getAppPath(),'..','..','docs','skills');
    try { for (const entry of await readdir(bundledRoot,{withFileTypes:true})) { if(!entry.isDirectory())continue; const path=join(bundledRoot,entry.name); try { const content=await readFile(join(path,'SKILL.md'),'utf8'); skills.push({name:entry.name,path,description:content.slice(0,500),format:recipeFormat(content),bundled:true}); } catch {} } } catch {}
    return {servers:configuredServers(file),skills,skillsRoot,ffmpegPath:ffmpegPath(),...(req.action==='save-skill'?{revision:createHash('sha256').update(req.content!).digest('hex')}:{})};
  });
}
export function ffmpegPath(){return localToolPath('ffmpeg') ?? '';}
