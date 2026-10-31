import {afterEach,expect,it,vi} from 'vitest';
import {InternalPreviewWorker} from './preview-worker';
const state=vi.hoisted(()=>({failNext:true,created:0,autoReady:true}));
vi.mock('../projects',()=>({getProject:async(dir:string)=>({id:'fixture',dir})}));
vi.mock('electron',async()=>{
  const {EventEmitter}=await import('node:events');
  const ipcMain=new EventEmitter();
  class BrowserWindow extends EventEmitter {
    webContents=Object.assign(new EventEmitter(),{mainFrame:{},setAudioMuted(){},setWindowOpenHandler(){}});
    destroyed=false;
    constructor(){super();state.created++;}
    isDestroyed(){return this.destroyed;}
    destroy(){this.destroyed=true;this.emit('closed');}
    async loadFile(){
      if(state.failNext){state.failNext=false;throw Error('Missing preview module');}
      if(state.autoReady) queueMicrotask(()=>ipcMain.emit('dapi:preview-ready',{sender:this.webContents,senderFrame:this.webContents.mainFrame}));
    }
  }
  return {ipcMain,BrowserWindow};
});
afterEach(()=>{state.failNext=true;state.created=0;state.autoReady=true;});
it('replaces a failed startup instead of retaining a rejected promise',async()=>{
  const callIn=vi.fn(async()=>({ready:true})),trustWindow=vi.fn();
  const worker=new InternalPreviewWorker({callIn} as never,{preload:'fixture.js',pagePath:'preview.html',trustWindow});
  const job={project:{id:'fixture',dir:'E:/fixture'},tool:'context' as const,args:{}};
  try {
    await expect(worker.run(job,new AbortController().signal)).rejects.toThrow('Missing preview module');
    expect(worker.status().loaded).toBe(false);
    expect(await worker.run(job,new AbortController().signal)).toEqual({ready:true});
    expect(state.created).toBe(2);
    expect(callIn).toHaveBeenCalledTimes(1);
  } finally {worker.reset();}
});

it('accepts readiness only from each worker main frame and removes only the recycled worker from trust', async()=>{
  const {ipcMain}=await import('electron');
  type Window = import('electron').BrowserWindow;
  state.failNext=false;
  state.autoReady=false;
  const trusted=new Set<Window>(), windows:Window[]=[];
  const trustWindow=(window:Window|null,removed?:Window)=>{
    if(removed) trusted.delete(removed);
    if(window){trusted.add(window);windows.push(window);}
  };
  const callIn=vi.fn(async(window:Window)=>({window:windows.indexOf(window)}));
  const options={preload:'fixture.js',pagePath:'preview.html',trustWindow};
  const first=new InternalPreviewWorker({callIn} as never,options);
  const second=new InternalPreviewWorker({callIn} as never,options);
  const job={project:{id:'fixture',dir:'E:/fixture'},tool:'context',args:{}};
  try{
    const firstRun=first.run(job,new AbortController().signal);
    const secondRun=second.run(job,new AbortController().signal);
    await vi.waitFor(()=>expect(windows).toHaveLength(2));
    ipcMain.emit('dapi:preview-ready',{sender:{mainFrame:{}},senderFrame:{}});
    ipcMain.emit('dapi:preview-ready',{sender:windows[0]!.webContents,senderFrame:{}});
    await Promise.resolve();
    expect(callIn).not.toHaveBeenCalled();
    const ready=(window:Window)=>ipcMain.emit('dapi:preview-ready',{
      sender:window.webContents,senderFrame:window.webContents.mainFrame});
    ready(windows[1]!);
    expect(await secondRun).toEqual({window:1});
    expect(callIn).toHaveBeenCalledTimes(1);
    ready(windows[0]!);
    expect(await firstRun).toEqual({window:0});
    first.reset();
    expect(trusted.has(windows[0]!)).toBe(false);
    expect(trusted.has(windows[1]!)).toBe(true);
    expect(second.status().loaded).toBe(true);
    expect(await second.run(job,new AbortController().signal)).toEqual({window:1});
    expect(state.created).toBe(2);
  }finally{first.reset();second.reset();}
  expect(trusted.size).toBe(0);
});
