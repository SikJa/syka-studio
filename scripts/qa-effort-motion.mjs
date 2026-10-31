import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const output='output/effort-motion';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setViewportSize({width:1000,height:780});await page.goto('http://localhost:5188');await page.waitForTimeout(700);
 await page.evaluate(async()=>{
  const reactModule=await import('/node_modules/.vite/deps/react.js');const React=reactModule.default ?? reactModule;const domModule=await import('/node_modules/.vite/deps/react-dom_client.js');const createRoot=domModule.createRoot ?? domModule.default.createRoot;const {AgentComposer}=await import('/src/mirel-chat/features/agents/agent-composer.tsx');
  const host=document.createElement('div');host.id='effort-motion-demo';Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'1000',background:'var(--bg)',display:'grid',placeItems:'center',paddingTop:'390px'});document.body.append(host);
  function Demo(){const [effort,setEffort]=React.useState('low');return React.createElement('div',{style:{width:'430px'}},React.createElement(AgentComposer,{value:'',onChange:()=>{},onSubmit:()=>{},placeholder:'¿Qué querés cambiar en este video?',models:[{id:'codex:gpt-5.6-luna',label:'GPT-5.6-Luna'}],selectedModelId:'codex:gpt-5.6-luna',onModelChange:()=>{},efforts:[{id:'low',label:'Bajo'},{id:'medium',label:'Medio'},{id:'high',label:'Alto'},{id:'xhigh',label:'Extra alto'},{id:'max',label:'Máximo'},{id:'ultra',label:'Ultra'}],selectedEffortId:effort,onEffortChange:setEffort}));}createRoot(host).render(React.createElement(Demo));
 });
 await page.locator('#effort-motion-demo').getByRole('button',{name:'Elegir modelo y esfuerzo'}).click();const range=page.getByRole('slider',{name:'Esfuerzo'});await range.waitFor();await page.waitForTimeout(250);await page.screenshot({path:output+'/bajo.png'});
 const set=async(value)=>range.evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);
 await set(4);await page.waitForTimeout(50);const early=await page.locator('.syka-effort-effect').evaluate(el=>({opacity:getComputedStyle(el).opacity,transition:getComputedStyle(el).transitionDuration}));await page.waitForTimeout(1000);
 if(await range.getAttribute('aria-valuetext')!=='Máximo')throw Error('Max state mismatch');await page.screenshot({path:output+'/maximo.png'});
 const max=await page.locator('.syka-effort-thumb').evaluate(el=>({x:el.getBoundingClientRect().x,transform:getComputedStyle(el).transform}));
 await range.focus();await page.keyboard.press('ArrowLeft');await page.waitForTimeout(350);if(await range.getAttribute('aria-valuetext')!=='Extra alto')throw Error('Keyboard mapping mismatch');
 await page.waitForTimeout(100);if(await page.locator('.syka-effort-effect canvas').count())throw Error('Hidden canvas not released');
 const high=await page.locator('.syka-effort-thumb').evaluate(el=>({x:el.getBoundingClientRect().x}));if(high.x>=max.x)throw Error('Thumb did not move left');
 await set(4);await page.waitForTimeout(90);await set(3);await page.waitForTimeout(60);await set(4);await page.waitForTimeout(400);if(await page.locator('.syka-effort-effect canvas').count()!==1)throw Error('Rapid reversal lost effect');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);const reduced=await page.locator('.syka-effort-thumb').evaluate(el=>getComputedStyle(el).transitionDuration);if(reduced!=='0s')throw Error('Reduced motion not respected: '+reduced);if(await page.locator('.syka-effort-effect canvas').count())throw Error('Reduced motion still draws WebGL');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>document.documentElement.dataset.sykaMotion='reduced');await page.waitForTimeout(100);if(await page.locator('.syka-effort-effect canvas').count())throw Error('App reduced motion still draws WebGL');await page.evaluate(()=>delete document.documentElement.dataset.sykaMotion);await page.waitForTimeout(300);
 const bounds=await range.boundingBox();await page.mouse.move(bounds.x+10,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width-10,bounds.y+bounds.height/2,{steps:8});await page.mouse.up();if(await range.inputValue()!=='5')throw Error('Pointer drag mismatch');await range.press('Home');if(await range.inputValue()!=='0')throw Error('Home mapping');await range.press('End');if(await range.inputValue()!=='5')throw Error('End mapping');
 await page.evaluate(()=>document.documentElement.dataset.theme='light');await set(4);await page.waitForTimeout(400);await page.screenshot({path:output+'/claro.png'});await writeFile(output+'/verification.json',JSON.stringify({early,max,high,reduced,errors,checks:['native pointer dragging and keyboard mapping','sliding thumb','effect crossfade','exit canvas cleanup','rapid reversal','OS and app reduced motion']},null,2));if(errors.length)throw Error(errors.join('\n'));
 const client=await page.context().newCDPSession(page);let frames=[];client.on('Page.screencastFrame',event=>{frames.push({data:event.data,t:event.metadata.timestamp});client.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});});
 await range.press('Home');await page.waitForTimeout(250);await client.send('Page.startScreencast',{format:'png',everyNthFrame:2});
 for(const value of [1,2,3,4,3,4,0]){await set(value);await page.waitForTimeout(value===4?800:500);}
 await client.send('Page.stopScreencast');await mkdir(output+'/frames',{recursive:true});let manifest='';for(let i=0;i<frames.length;i++){await writeFile(output+'/frames/'+i+'.png',Buffer.from(frames[i].data,'base64'));manifest+="file 'frames/"+i+".png'\n";if(i+1<frames.length)manifest+='duration '+Math.max(.01,frames[i+1].t-frames[i].t)+'\n';}if(frames.length)manifest+="file 'frames/"+(frames.length-1)+".png'\n";await writeFile(output+'/frames.txt',manifest);console.log('Effort motion checks passed; recorded '+frames.length+' frames');
}finally{await page.close();await browser.close()}




