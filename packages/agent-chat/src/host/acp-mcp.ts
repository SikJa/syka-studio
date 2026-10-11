import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// ACP v1 always supports stdio MCP. This proxy adds it for agents that don't
// advertise HTTP, without changing their capabilities or starting another editor.
const PROXY = `import { createInterface } from 'node:readline';
const url = process.env.SYKA_MCP_PROXY_URL;
let session;
createInterface({ input: process.stdin }).on('line', async line => {
  let msg;
  try {
    msg = JSON.parse(line);
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(session ? { 'Mcp-Session-Id': session } : {}) }, body: line });
    session = response.headers.get('mcp-session-id') || session;
    if (msg.id === undefined) return;
    if (!response.ok) throw Error('MCP transport error');
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const reader=response.body.getReader(); const decoder=new TextDecoder(); let buffer='';
      try { for (;;) { const {value,done}=await reader.read(); if(done)break; buffer+=decoder.decode(value,{stream:true}); let i;
        while((i=buffer.indexOf('\\n'))>=0){const row=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(!row.startsWith('data:'))continue;
          const result=JSON.parse(row.slice(5));if(result.id===msg.id){process.stdout.write(JSON.stringify(result)+'\\n');return;}}
      }} finally { await reader.cancel(); }
      throw Error('MCP ended without a response');
    }
    const result=await response.json(); process.stdout.write(JSON.stringify(result)+'\\n');
  } catch { if(msg?.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,error:{code:-32603,message:'MCP transport failed'}})+'\\n'); }
});`;

export async function acpMcpServers(servers: { name: string; url: string }[], http: boolean, profileDir: string): Promise<unknown[]> {
  if (http) return servers.map(server => ({ ...server, type: "http", headers: [] }));
  const script = join(profileDir, "syka-mcp-proxy.mjs");
  await writeFile(script, PROXY, "utf8");
  return servers.map(server => ({ name: server.name, command: process.execPath, args: [script], env: [
    { name: "SYKA_MCP_PROXY_URL", value: server.url }, { name: "ELECTRON_RUN_AS_NODE", value: "1" },
  ] }));
}
