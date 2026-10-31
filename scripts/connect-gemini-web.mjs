// Local opt-in configuration for the browser-backed OpenCode route.
// Does not copy Google credentials, change the selected model, or restart Syka.
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
const [runtimeRoot,bridgeRoot,command]=process.argv.slice(2);
if(!runtimeRoot||!bridgeRoot||!isAbsolute(runtimeRoot)||!isAbsolute(bridgeRoot)) throw Error('Usage: node scripts/connect-gemini-web.mjs <absolute Syka runtime root> <absolute bridge root>');
const key=join(bridgeRoot,'Datos','bridge.key');
if(!(await stat(key)).isFile()) throw Error('Prepare the local bridge credential first.');
if(command && (!isAbsolute(command)||!(await stat(command)).isFile()))throw Error('Use an existing absolute OpenCode executable.');
const dir=join(runtimeRoot,'harness-profiles','gemini-web','config','opencode');
const file=join(dir,'opencode.json');
await mkdir(dir,{recursive:true});
let config={};
try{config=JSON.parse(await readFile(file,'utf8'));await copyFile(file,`${file}.backup-${Date.now()}`);}catch(error){if(error.code!=='ENOENT')throw error;}
config.provider??={};
if(config.provider['gemini-web-syka']) throw Error('Route already configured; review it instead of overwriting.');
config.provider['gemini-web-syka']={npm:'@ai-sdk/openai-compatible',name:'Gemini Web experimental',
  options:{baseURL:'http://127.0.0.1:28181/v1',apiKey:`{file:${key.replaceAll('\\','/')}}`},
  models:{'web-argon':{name:'Argon en Gemini Web (experimental)',limit:{context:30000,output:4096}}}};
if(Array.isArray(config.enabled_providers)&&!config.enabled_providers.includes('gemini-web-syka'))config.enabled_providers.push('gemini-web-syka');
config.enabled_providers=['gemini-web-syka'];
config.model='gemini-web-syka/web-argon';
config.small_model='gemini-web-syka/web-argon';
// Syka's integrated editor runs with the user's requested full tool access.
config.permission='allow';
// The browser worker is serial. Auxiliary title/summary requests would queue
// ahead of the actual edit and consume its timeout budget.
config.agent={...config.agent,title:{...config.agent?.title,disable:true},summary:{...config.agent?.summary,disable:true}};
await writeFile(file,JSON.stringify(config,null,2)+'\n');
await writeFile(join(runtimeRoot,'gemini-web.json'),JSON.stringify({bridgeRoot,...(command?{command}:{})},null,2)+'\n');
console.log('Conector Gemini Web experimental configurado con su propio perfil. OpenCode es el transporte temporal.');
console.log('30k/4096 son límites conservadores del cliente, no capacidades certificadas de Google.');
