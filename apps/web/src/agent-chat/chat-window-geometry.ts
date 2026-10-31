export type ChatGeometry={x:number;y:number;width:number;height:number};
export type ResizeEdge='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw';
export function boundChat(value:ChatGeometry,viewport:{width:number;height:number}):ChatGeometry{
  const width=Math.min(Math.max(320,value.width),Math.max(200,viewport.width-24));
  const height=Math.min(Math.max(320,value.height),Math.max(200,viewport.height-72));
  return {width,height,x:Math.min(Math.max(12,value.x),Math.max(12,viewport.width-width-12)),y:Math.min(Math.max(44,value.y),Math.max(44,viewport.height-height-12))};
}
export function resizeChat(g:ChatGeometry,edge:ResizeEdge,dx:number,dy:number,viewport:{width:number;height:number}):ChatGeometry{
  const left=edge.includes('w')?Math.min(g.x+g.width-320,Math.max(12,g.x+dx)):g.x;
  const top=edge.includes('n')?Math.min(g.y+g.height-320,Math.max(44,g.y+dy)):g.y;
  const width=edge.includes('w')?g.width+g.x-left:edge.includes('e')?Math.min(viewport.width-g.x-12,g.width+dx):g.width;
  const height=edge.includes('n')?g.height+g.y-top:edge.includes('s')?Math.min(viewport.height-g.y-12,g.height+dy):g.height;
  return boundChat({x:left,y:top,width,height},viewport);
}
export function isChatDockPoint(x:number,y:number,rect:{left:number;right:number;top:number;bottom:number}|undefined):boolean{
  return !!rect&&rect.right>rect.left&&rect.bottom>rect.top&&x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
}
