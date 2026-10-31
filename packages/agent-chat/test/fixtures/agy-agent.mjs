import { createInterface } from 'node:readline';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const args=process.argv.slice(2);
if(args.includes('--version')) { console.log('1.2.17'); process.exit(0); }
if(args.includes('models')) {
  if (process.env.SYKA_TEST_AGY_FAILURE) {
    console.error(process.env.SYKA_TEST_AGY_FAILURE === 'auth' ? 'Authentication required. Run agy interactively to sign in.' : 'Network connection unavailable.');
    process.exit(1);
  }
  console.log('claude-opus-5-5-low\tClaude Opus 5.5 (Low)\nclaude-sonnet-5-5-medium\tClaude Sonnet 5.5 (Medium)\ngemini-3.8-flash-high\tGemini 3.8 Flash (High)'); process.exit(0);
}
for await (const line of createInterface({input:process.stdin})) {
  const text=JSON.parse(line).message.content;
  if (process.env.SYKA_TEST_AGY_RECEIPTS) {
    const config=JSON.parse(readFileSync(join(process.cwd(),'.agents','mcp_config.json'),'utf8'));
    appendFileSync(process.env.SYKA_TEST_AGY_RECEIPTS,JSON.stringify({cwd:process.cwd(),names:Object.keys(config.mcpServers).filter(name=>name.startsWith('syka_')),fullAccess:args.includes('--dangerously-skip-permissions'),conversation:args.includes('--conversation')?args[args.indexOf('--conversation')+1]:null,currentServersExplained:text.includes('Los únicos MCP vigentes para este turno')})+'\n');
  }
  console.log(JSON.stringify({event:'init',conversation_id:'fixture-session',init:{model:args[args.indexOf('--model')+1]}}));
  if(text.includes('WAIT_FOREVER')) {await new Promise(()=>{});continue;}
  if(!args.includes('--dangerously-skip-permissions')) {
    console.log(JSON.stringify({event:'result',result:{status:'ERROR',error:{message:'permission check failed: headless tool denied'}}}));continue;
  }
  if(text.includes('QUOTA_RESULT')) {
    console.log(JSON.stringify({event:'result',result:{status:'ERROR',error:{code:429,message:'Individual quota reached. Resets in 4h38m58s. auth=secret account@example.test'}}}));continue;
  }
  if(text.includes('RATE_LIMIT_RESULT')) {
    console.log(JSON.stringify({event:'result',result:{status:'ERROR',error:{code:429,message:'Too many requests. Resets in 30s. auth=secret account@example.test'}}}));continue;
  }
  if(text.includes('QUOTA_STDERR')) {
    console.error('Print mode: run ended with error and no response: RESOURCE_EXHAUSTED (code 429): Individual quota reached. Resets in 2h1m. auth=secret');process.exit(1);
  }
  if(text.includes('TOOL_DENIED')||text.includes('STALE_MCP')) {
    const message=text.includes('STALE_MCP')?'invalid tool call error (invalid_args) tool syka_skills is not enabled for server syka_old_workspace':'permission check failed for read_file: user denied permission';
    console.log(JSON.stringify({event:'step_update',step_update:{step_index:0,state:'ERROR',step_type:'tool',tool_name:'call_mcp_tool',tool_info:{error:{message}}}}));
    console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:''}}));continue;
  }
  if(text.includes('SILENT_AUTH_EMPTY')) {
    console.error('error getting token source: You are not logged into Antigravity.');
    console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:''}}));continue;
  }
  if(text.includes('SCHEMA_TOOL')) {
    console.log(JSON.stringify({event:'step_update',step_update:{step_index:0,state:'ERROR',step_type:'tool',tool_name:'write_file',tool_info:{error:{message:"invalid arguments:\n- at '/ArtifactMetadata': got string, want object\n- additional properties 'RequestFeedback', 'UserFacing' not allowed private-secret"}}}}));
    console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:''}}));continue;
  }
  if(text.includes('TERMINAL_ERROR_WITH_TEXT')) {
    console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:'A draft was produced',error:{message:'INVALID_ARGUMENT native terminal error private-secret'}}}));continue;
  }
  if(text.includes('TERMINAL_STDERR_WITH_TEXT')) {
    console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:'A draft was produced'}}));
    console.error('Print mode: run ended with error: INVALID_ARGUMENT private-secret');process.exit(1);
  }
  if(text.includes('RECOVERED_TOOL_WITH_TEXT')) {
    console.log(JSON.stringify({event:'step_update',step_update:{step_index:0,state:'ERROR',step_type:'tool',tool_name:'write_file',tool_info:{error:{message:'invalid arguments private-secret'}}}}));
    console.log(JSON.stringify({event:'step_update',step_update:{step_index:1,state:'DONE',step_type:'tool',tool_name:'write_file',tool_info:{output:'Saved correctly'}}}));
    console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:'Edición verificada'}}));continue;
  }
  console.log(JSON.stringify({event:'step_update',step_update:{step_index:1,state:'ACTIVE',step_type:'agent_response',text_delta:'Hola '}}));
  console.log(JSON.stringify({event:'step_update',step_update:{step_index:1,state:'DONE',step_type:'agent_response',text_delta:'Syka',usage:{total_tokens:30,input_tokens:20,output_tokens:10}}}));
  if(text.includes('MISSING_RESULT')) {process.exit(0);}
  console.log(JSON.stringify({event:'result',result:{conversation_id:'fixture-session',status:text.includes('FAILED_RESULT')?'ERROR':'SUCCESS',response:text.includes('EMPTY_RESULT')?'':'Hola Syka',usage:{total_tokens:40,input_tokens:30,output_tokens:10,cache_read_tokens:15,thinking_tokens:3}}}));
}
