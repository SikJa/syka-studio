import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ emit: vi.fn(), handlers: new Map<string, Function>() }));
vi.mock('electron', () => ({
  app: { isPackaged:false, whenReady:async()=>{}, on:()=>{}, getAppPath:()=>process.cwd() },
  screen: { getCursorScreenPoint:()=>({x:0,y:0}), getDisplayNearestPoint:()=>({workArea:{x:0,y:0,width:1200,height:900}}) },
  shell:{},
  BrowserWindow: class {
    webContents={ setWindowOpenHandler(){},on(){},getBackgroundThrottling:()=>false };
    on(){} setShape(){} setIgnoreMouseEvents(){} setAlwaysOnTop(){} loadURL(){} setBounds(){} showInactive(){} moveTop(){} hide(){}
    isDestroyed(){return false} isVisible(){return false} isAlwaysOnTop(){return true}
    getBounds(){return {x:0,y:0,width:300,height:500}}
  },
}));
vi.mock('./main-manager',()=>({mainBridge:{emit:state.emit,handle:(key:string,handler:Function)=>state.handlers.set(key,handler)}}));
vi.mock('./projects',()=>({getProject:async()=>({id:'p',name:'QA'})}));
vi.mock('./agent-chat',()=>({answerAgentNotice:async()=>{}}));
vi.mock('./notification-images',()=>({NotificationImages:class{discard=async()=>{}}}));
import { MAIN_CHANNELS } from './main-channels';
import { registerNotifications, reportNotice } from './notifications';
afterEach(()=>vi.useRealTimers());
it('coalesces a burst at the real desktop delivery boundary and closes expired popups', async()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);registerNotifications(()=>null);
  await Promise.resolve();
  state.emit.mockClear();
  for(let i=0;i<200;i++)await reportNotice('qa',{kind:'blocked',operationId:String(i),message:'same compiler failure'});
  await vi.advanceTimersByTimeAsync(61);
  expect(state.emit).toHaveBeenCalledOnce();
  expect(state.emit.mock.calls[0]![2].notices).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(8001);
  expect(state.emit.mock.calls.at(-1)![2].notices).toEqual([]);
  const handler=state.handlers.get(MAIN_CHANNELS.SYKA_NOTIFICATIONS)!;
  expect((await handler({action:'list'},{sender:{}})).notices).toEqual([]);
});
