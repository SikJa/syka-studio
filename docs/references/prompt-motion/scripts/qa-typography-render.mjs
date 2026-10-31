// Re-render existing source in the isolated app; no model turn or source mutation.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const resources=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(await readFile(join(resources,'evidence/typography-integration.json'),'utf8'));
const client=new Client({name:'typography-rerender',version:'1'});
await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3317/mcp')));
async function tool(name,args){const r=await client.callTool({name,arguments:args},undefined,{timeout:180000});if(r.isError)throw Error(JSON.stringify(r.content));return r.structuredContent||JSON.parse(r.content.filter(x=>x.type==='text').map(x=>x.text).join(''));}
try{
 const context=await tool('context',{});assert.equal(resolve(context.projectDir).toLowerCase(),resolve(data.project).toLowerCase());
 const target=join(data.project,'02 Finales','rerender-'+new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(target,{recursive:true});
 for(const id of ['qa_type_before','qa_type_motion','qa_type_after']){const checked=await tool('check',{id});assert.equal(checked.issues.length,0);console.log(await tool('export',{id,path:join(target,id+'.mp4')}));}
}finally{await client.close();}
