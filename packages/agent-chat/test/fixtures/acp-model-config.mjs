import { createInterface } from 'node:readline';
const mode = process.argv[2] ?? '';
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
const first = 'openai-codex:gpt-6.1-sol', second = 'openai-codex:gpt-5.6-sol';
let model = first, effort = 'medium';
const levels = () => model === first ? ['low', 'medium', 'high'] : ['low', 'high', 'max'];
const configs = () => [{id:'native-model',type:'select',category:'model',currentValue:model,options:[{group:'account',name:'Subscription',options:[
  {value:first,name:'ChatGPT or Codex Subscription · gpt-6.1-sol',_meta:{syka:{reasoningEfforts:['low','medium','high'],defaultEffort:'medium'}}},
  {value:second,name:'ChatGPT or Codex Subscription · gpt-5.6-sol',_meta:{syka:{reasoningEfforts:['low','high','max'],defaultEffort:'high'}}},
]}]}, {id:'native-thought',type:'select',category:'thought_level',currentValue:effort,options:levels().map(value=>({value,name:value}))}];
createInterface({ input:process.stdin }).on('line', line => {
  const message = JSON.parse(line), params = message.params ?? {};
  const result = data => send({id:message.id,result:data});
  switch(message.method) {
    case 'initialize': result({protocolVersion:1,agentInfo:{name:'hermes-acp',version:'fixture'},agentCapabilities:{mcpCapabilities:{http:true}}}); break;
    case 'session/new': result({sessionId:'s1',models:{currentModelId:first,availableModels:[{modelId:'stale-legacy',name:'Do not use old catalog'}]},configOptions:configs()}); break;
    case 'session/set_config_option':
      if (mode === 'no-ack') { result({configOptions:configs()}); break; }
      if (params.configId === 'native-model') { model = params.value; effort = levels().includes('medium') ? 'medium' : 'high'; }
      else if (params.configId === 'native-thought' && levels().includes(params.value)) effort = params.value;
      else { send({id:message.id,error:{code:-32602,message:'Unsupported option'}}); break; }
      result({configOptions:configs()}); break;
    case 'session/prompt':
      send({method:'session/update',params:{sessionId:'s1',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:JSON.stringify({model,effort})}}}});
      result({stopReason:'end_turn'}); break;
  }
});
