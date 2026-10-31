import {describe,it,expect} from 'vitest';
import {resizeChat,isChatDockPoint,boundChat} from './chat-window-geometry';
const viewport={width:1366,height:900},g={x:400,y:200,width:500,height:480};
describe('chat sizing and docking',()=>{
  it('keeps the opposite corner fixed when resizing from northwest',()=>{
    const resized=resizeChat(g,'nw',50,40,viewport);
    expect(resized).toEqual({x:450,y:240,width:450,height:440});
    expect(resized.x+resized.width).toBe(g.x+g.width);
    expect(resized.y+resized.height).toBe(g.y+g.height);
  });
  it('clamps every edge to the viewport and keeps the controls reachable',()=>{
    for(const edge of ['n','s','e','w','ne','nw','se','sw'] as const){
      const r=resizeChat(g,edge,2000,2000,viewport);expect(r.width).toBeGreaterThanOrEqual(320);expect(r.height).toBeGreaterThanOrEqual(320);expect(r.x+r.width).toBeLessThanOrEqual(1354);expect(r.y+r.height).toBeLessThanOrEqual(888);
    }
    expect(boundChat(g,{width:390,height:600}).width).toBe(366);
  });
  it('docks only inside the visible sidebar, including below its titlebar',()=>{
    const rect={left:0,right:340,top:48,bottom:650};
    expect(isChatDockPoint(180,300,rect)).toBe(true);
    expect(isChatDockPoint(20,20,rect)).toBe(false);
    expect(isChatDockPoint(20,800,rect)).toBe(false);
    expect(isChatDockPoint(20,300,undefined)).toBe(false);
  });
});
