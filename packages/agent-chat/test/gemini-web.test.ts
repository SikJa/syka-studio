import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const fake=vi.hoisted(()=>({probe:vi.fn(),open:vi.fn(),send:vi.fn(),config:null as any}));
vi.mock('../src/host/acp',()=>({AcpHarness:class {constructor(config:any){fake.config=config;}probe=fake.probe;open=fake.open;}}));
vi.mock('../src/host/opencode',()=>({findOpenCode:vi.fn()}));
import {geminiWebHarness} from '../src/host/gemini-web';
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
describe('separate experimental Gemini Web connector',()=>{
  it.each(['timeout','acp','slow-tab','unresponsive-tab'])('distinguishes %s from a disconnected account',async(mode)=>{
    const root=await mkdtemp(join(tmpdir(),'syka-gemini-health-'));
    try {
      await mkdir(join(root,'Datos'));
      await writeFile(join(root,'Datos','bridge.key'),'local-test-key');
      await writeFile(join(root,'gemini-web.json'),JSON.stringify({bridgeRoot:root,transport:'extension',command:process.execPath}));
      fake.probe.mockImplementation(async()=>{
        if(mode==='acp') throw Error('private internal error');
        return {status:'ready',models:[{id:'gemini-web-syka/web-argon',label:'Argon'}]};
      });
      vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{
        if(mode==='timeout') throw new DOMException('slow','TimeoutError');
        if(mode==='slow-tab') {
          await new Promise(resolve=>setTimeout(resolve,4500));
          options.signal.throwIfAborted();
        }
        return {ok:true,json:async()=>({service:'syka-gemini-web-bridge',transport:'extension',status:mode==='unresponsive-tab'?'browser-unavailable':'ready',observedModel:'Argon'})};
      }));
      const result=await geminiWebHarness(join(root,'profiles')).probe({env:{},extraDirs:[]},new AbortController().signal);
      expect(result.status).toBe(mode==='slow-tab'?'ready':'error');
      expect(result.detail).not.toContain('Iniciá el puente');
      expect(result.detail).not.toContain('private internal');
      if(mode==='acp') expect(result.detail).toContain('componente de ejecución ACP');
      if(mode==='timeout') expect(result.detail).toContain('no terminó a tiempo');
    } finally {
      if(!root.startsWith(join(tmpdir(),'syka-gemini-health-'))) throw Error('Unexpected cleanup path');
      await rm(root,{recursive:true,force:true});
    }
  },10000);
  it('reports the actual selected model immediately instead of waiting for login on a connected tab',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-gemini-selected-'));
    try {
      await mkdir(join(root,'Datos'));
      await writeFile(join(root,'Datos','bridge.key'),'local-test-key');
      await writeFile(join(root,'gemini-web.json'),JSON.stringify({bridgeRoot:root,transport:'extension',port:28183}));
      const fetch=vi.fn(async(_url:unknown)=>({ok:true,json:async()=>({service:'syka-gemini-web-bridge',transport:'extension',status:'model-not-selected',observedModel:'Flash-Lite Abrir selector de modo, actualmente Flash-Lite'})}));
      vi.stubGlobal('fetch',fetch);
      const harness=geminiWebHarness(join(root,'profiles')),env={env:{},extraDirs:[]};
      const info=await harness.probe(env,new AbortController().signal);
      expect(info).toMatchObject({status:'error',models:[]});
      expect(info.detail).toContain('seleccionado Flash-Lite');
      expect(info.detail).toContain('No hace falta iniciar sesión otra vez');
      expect(info.detail).not.toContain('Abrir selector de modo');
      // No launcher exists: a wrong model must finish with its own diagnosis before launch/polling.
      await expect(harness.authenticate!(env,'browser',new AbortController().signal)).rejects.toThrow('seleccionado Flash-Lite');
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[0]?.[0]).toBe('http://127.0.0.1:28183/health');
      expect(fake.probe).not.toHaveBeenCalled();
      expect(fake.open).not.toHaveBeenCalled();
    } finally {
      if (!root.startsWith(join(tmpdir(),'syka-gemini-selected-'))) throw Error('Unexpected cleanup path');
      await rm(root,{recursive:true,force:true});
    }
  });
  it('accepts an already connected Argon tab without launching a browser or requiring another login',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-gemini-ready-tab-'));
    try {
      await mkdir(join(root,'Datos'));
      await writeFile(join(root,'Datos','bridge.key'),'local-test-key');
      await writeFile(join(root,'gemini-web.json'),JSON.stringify({bridgeRoot:root,transport:'extension'}));
      const fetch=vi.fn(async()=>({ok:true,json:async()=>({service:'syka-gemini-web-bridge',transport:'extension',status:'ready',observedModel:'Argon'})}));
      vi.stubGlobal('fetch',fetch);
      await expect(geminiWebHarness(join(root,'profiles')).authenticate!({env:{},extraDirs:[]},'browser',new AbortController().signal)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fake.open).not.toHaveBeenCalled();
    } finally {
      if (!root.startsWith(join(tmpdir(),'syka-gemini-ready-tab-'))) throw Error('Unexpected cleanup path');
      await rm(root,{recursive:true,force:true});
    }
  });
  it('reports a rejected Google login without launching another browser or opening an agent session',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-gemini-blocked-'));
    try {
      await mkdir(join(root,'Datos'));
      await writeFile(join(root,'Datos','bridge.key'),'local-test-key');
      await writeFile(join(root,'gemini-web.json'),JSON.stringify({bridgeRoot:root,command:process.execPath}));
      vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({service:'syka-gemini-web-bridge',status:'authentication-blocked'})})));
      const harness=geminiWebHarness(join(root,'profiles'));
      const env={env:{},extraDirs:[]};
      const info=await harness.probe(env,new AbortController().signal);
      expect(info).toMatchObject({status:'error',models:[],authMethods:[]});
      expect(info.detail).toContain('Google rechazó');
      // There is deliberately no browser executable or launcher in this fixture.
      await expect(harness.authenticate!(env,'browser',new AbortController().signal)).rejects.toThrow('Google rechazó');
      expect(fake.probe).not.toHaveBeenCalled();
      expect(fake.open).not.toHaveBeenCalled();
    } finally {await rm(root,{recursive:true,force:true});}
  });
  it('keeps its own profile and identity, only exposes Argon, and refuses a model change',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-gemini-'));
    try{
      const profiles=join(root,'profiles');await mkdir(join(root,'Datos'),{recursive:true});
      await writeFile(join(root,'Datos','bridge.key'),'local-test-key');
      await writeFile(join(root,'gemini-web.json'),JSON.stringify({bridgeRoot:root,command:process.execPath}));
      vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({service:'syka-gemini-web-bridge',status:'ready',observedModel:'Gemini Argon'})})));
      fake.probe.mockResolvedValue({status:'ready',models:[{id:'gemini-web-syka/web-argon',label:'Argon'},{id:'other/model',label:'Other'}]});
      fake.send.mockResolvedValue({status:'completed'});
      fake.open.mockResolvedValue({resume:{acp:{version:1,harness:'gemini-web',sessionId:'test',profile:'test'}},send:fake.send,close:vi.fn(),interrupt:vi.fn(),respond:vi.fn()});
      const harness=geminiWebHarness(profiles), env={env:{},extraDirs:[]};
      expect(await harness.probe(env,new AbortController().signal)).toMatchObject({id:'gemini-web',status:'ready',models:[{id:'web-argon',label:'Argon · Experimental'}]});
      expect(fake.config).toMatchObject({id:'gemini-web',openCodeAccount:'syka',profileDir:join(profiles,'gemini-web')});
      const session=await harness.open({cwd:root,env,mcp:null,model:'web-argon',emit:()=>{}});
      expect(await session.send('hello','other',()=>{})).toMatchObject({status:'failed'});expect(fake.send).not.toHaveBeenCalled();
      expect(await session.send('hello','web-argon',()=>{})).toEqual({status:'completed'});
      expect(fake.send.mock.calls[0][1]).toBe('gemini-web-syka/web-argon');
      vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({service:'syka-gemini-web-bridge',status:'ready',observedModel:'Flash'})})));
      expect(await session.send('hello','web-argon',()=>{})).toMatchObject({status:'failed'});expect(fake.send).toHaveBeenCalledTimes(1);
    }finally{await rm(root,{recursive:true,force:true});}
  });
  it('does not invent available models when there is no installation',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-gemini-missing-'));
    try{expect(await geminiWebHarness(join(root,'profiles')).probe({env:{},extraDirs:[]},new AbortController().signal)).toMatchObject({status:'not-installed',models:[]});expect(fake.probe).not.toHaveBeenCalled();}
    finally{await rm(root,{recursive:true,force:true});}
  });
});
