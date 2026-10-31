import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(process.argv[2]);
const port=Number(process.argv[3]||5331);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf','.png':'image/png','.mp4':'video/mp4','.json':'application/json'};
const server=createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const target=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 const data=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}});
server.listen(port,'127.0.0.1',()=>console.log('SYKA_PREVIEW_READY http://127.0.0.1:'+port));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
