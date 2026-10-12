import { createInterface } from 'node:readline';
const args=process.argv.slice(2);
if(args.includes('--version')) { console.log('1.2.17'); process.exit(0); }
if(args.includes('models')) {
  if (process.env.SYKA_TEST_AGY_FAILURE) {
    console.error(process.env.SYKA_TEST_AGY_FAILURE === 'auth' ? 'Authentication required. Run agy interactively to sign in.' : 'Network connection unavailable.');
    process.exit(1);
  }
  console.log('claude-opus-5-5-low\tClaude Opus 5.5 (Low)\nclaude-sonnet-5-5-medium\tClaude Sonnet 5.5 (Medium)'); process.exit(0);
}
for await (const line of createInterface({input:process.stdin})) {
  const text=JSON.parse(line).message.content;
  console.log(JSON.stringify({event:'init',conversation_id:'fixture-session',init:{model:args[args.indexOf('--model')+1]}}));
  if(text.includes('WAIT_FOREVER')) {await new Promise(()=>{});continue;}
  console.log(JSON.stringify({event:'step_update',step_update:{step_index:1,state:'ACTIVE',step_type:'agent_response',text_delta:'Hola '}}));
  console.log(JSON.stringify({event:'step_update',step_update:{step_index:1,state:'DONE',step_type:'agent_response',text_delta:'Syka',usage:{total_tokens:30,input_tokens:20,output_tokens:10}}}));
  if(text.includes('MISSING_RESULT')) {process.exit(0);}
  console.log(JSON.stringify({event:'result',result:{conversation_id:'fixture-session',status:text.includes('FAILED_RESULT')?'ERROR':'SUCCESS',response:text.includes('EMPTY_RESULT')?'':'Hola Syka',usage:{total_tokens:40,input_tokens:30,output_tokens:10,cache_read_tokens:15,thinking_tokens:3}}}));
}
