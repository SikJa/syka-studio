/** Local, transparent desktop selector. No animation loop, network or recording. */
export function screenRegionHtml(width: number, height: number): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:Segoe UI,Arial,sans-serif;color:#eee;cursor:crosshair;user-select:none;touch-action:none}body{background:#0005}#zone{position:fixed;display:none;border:2px solid #afd2ff;background:transparent;box-shadow:0 0 0 10000px #0006;pointer-events:none}#help{position:fixed;top:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:18px;max-width:calc(100% - 32px);padding:12px 16px;background:#191919;border:1px solid #ffffff24;border-radius:12px;box-shadow:0 8px 24px #0005;cursor:default}strong{font-size:14px}small{display:block;color:#aaa;font-size:12px;margin-top:4px}button{border:1px solid #ffffff24;border-radius:7px;background:#252525;color:#ddd;padding:7px 10px;cursor:pointer;white-space:nowrap}button:focus-visible{outline:2px solid #afd2ff}#size{position:fixed;display:none;padding:5px 8px;background:#191919;border:1px solid #ffffff24;border-radius:6px;font-size:12px;pointer-events:none}</style></head>
  <body><div id="zone"></div><div id="size"></div><div id="help"><div><strong>Elegí la zona para grabar</strong><small id="hint">Arrastrá un rectángulo. Al soltar empieza la grabación.</small></div><button id="cancel" type="button">Cancelar · Esc</button></div>
  <script>
  const zone=document.getElementById('zone'),label=document.getElementById('size');let origin=null,done=false,pointer=null;
  const point=e=>({x:Math.max(0,Math.min(1,e.clientX/innerWidth)),y:Math.max(0,Math.min(1,e.clientY/innerHeight))});
  const rect=e=>{const p=point(e);return{x:Math.min(origin.x,p.x),y:Math.min(origin.y,p.y),width:Math.abs(p.x-origin.x),height:Math.abs(p.y-origin.y)}};
  function cancel(){if(done)return;done=true;origin=null;window.sykaRegion.cancel();}
  document.getElementById('cancel').onclick=cancel;window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();cancel();}});
  document.body.addEventListener('pointerdown',e=>{if(done||e.button!==0||e.target.closest('#help'))return;origin=point(e);pointer=e.pointerId;document.body.setPointerCapture(pointer);e.preventDefault();});
  document.body.addEventListener('pointermove',e=>{if(!origin||done)return;const r=rect(e);zone.style.cssText='display:block;left:'+r.x*100+'%;top:'+r.y*100+'%;width:'+r.width*100+'%;height:'+r.height*100+'%';label.style.cssText='display:block;left:'+Math.min(innerWidth-140,r.x*innerWidth+8)+'px;top:'+Math.max(6,r.y*innerHeight-32)+'px';label.textContent=Math.floor(r.width*${width})+' × '+Math.floor(r.height*${height})+' px';});
  document.body.addEventListener('pointerup',e=>{if(done||!origin||e.pointerId!==pointer)return;const r=rect(e);origin=null;pointer=null;if(document.body.hasPointerCapture(e.pointerId))document.body.releasePointerCapture(e.pointerId);if(Math.floor(r.width*${width})<16||Math.floor(r.height*${height})<16){zone.style.display=label.style.display='none';document.getElementById('hint').textContent='Elegí una zona de al menos 16 × 16 píxeles.';return;}done=true;window.sykaRegion.complete(r);});
  document.body.addEventListener('pointercancel',()=>{origin=null;pointer=null;zone.style.display=label.style.display='none';});
  document.body.addEventListener('lostpointercapture',()=>{origin=null;pointer=null;});
  </script></body></html>`;
}
