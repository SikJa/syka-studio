import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const out=resolve('../Pruebas Syka/Composing-pregunta-4-previews-2026-10-08');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const evidence={scope:'Four interactive prototypes; production chat is unchanged',errors:[]};
try {
 const context=await browser.newContext({viewport:{width:1920,height:1010},deviceScaleFactor:1,recordVideo:{dir:join(out,'evidence/recordings'),size:{width:1920,height:1010}}});
 const page=await context.newPage();const video=page.video();
 page.on('pageerror',error=>evidence.errors.push(error.message));
 await page.goto('http://127.0.0.1:5331/comparison.html');await page.waitForLoadState('networkidle');
 const frames=page.frames().filter(frame=>frame!==page.mainFrame());assert.equal(frames.length,4);
 await Promise.all(frames.map(frame=>frame.waitForFunction(()=>window.sykaPreview?.phase==='question')));
 await page.waitForTimeout(450);
 evidence.geometry=await Promise.all(frames.map(frame=>frame.evaluate(()=>{document.activeElement?.blur();const chat=document.querySelector('.chat').getBoundingClientRect(),button=document.querySelector('.continue').getBoundingClientRect(),footer=document.querySelector('.waiting-foot').getBoundingClientRect();return{buttonOverflow:button.bottom-chat.bottom,footerOverflow:footer.bottom-chat.bottom,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status}))};})));
 assert.ok(evidence.geometry.every(item=>item.buttonOverflow<=0&&item.footerOverflow<=0));
 await page.screenshot({path:join(out,'comparison-question.png')});
 await page.waitForTimeout(1600);
 for(let i=0;i<4;i++) {
  if(i===3) await frames[i].getByRole('textbox',{name:'Tu respuesta'}).fill('Íntimo y poético. Que la música acompañe el cierre.');
  else await frames[i].getByRole('button',{name:i===2?'O elegí vos la dirección':'Poético y abstracto',exact:false}).click();
 }
 await page.waitForTimeout(850);
 await Promise.all(frames.map(frame=>frame.getByRole('button',{name:'Continuar con mi respuesta'}).click()));
 await Promise.all(frames.map(frame=>frame.waitForFunction(()=>window.sykaPreview?.phase==='building')));
 await page.waitForTimeout(2700);await context.close();
 const mp4=join(out,'Syka-composing-4-previews.mp4');
 execFileSync('C:/ffmpeg/bin/ffmpeg.exe',['-hide_banner','-loglevel','error','-y','-i',await video.path(),'-an','-vf','fps=30','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',mp4],{windowsHide:true});
 evidence.video=JSON.parse(execFileSync('C:/ffmpeg/bin/ffprobe.exe',['-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate','-of','json',mp4],{windowsHide:true,encoding:'utf8'}));
 execFileSync('C:/ffmpeg/bin/ffmpeg.exe',['-hide_banner','-loglevel','error','-i',mp4,'-frames:v','1','-f','null','-'],{windowsHide:true});
 const gallery=await browser.newPage({viewport:{width:1200,height:1880}});
 await gallery.goto('http://127.0.0.1:5331/gallery.html');await gallery.waitForLoadState('networkidle');
 await Promise.all(gallery.frames().slice(1).map(frame=>frame.waitForFunction(()=>window.sykaPreview?.phase==='question')));
 await gallery.waitForTimeout(500);await gallery.screenshot({path:join(out,'gallery-question.png')});await gallery.close();
 // Only this HTML is copied: the portability check cannot rely on adjacent assets.
 const isolated=join(tmpdir(),'syka-composing-portable-'+Date.now());await mkdir(isolated);
 const portable=join(isolated,'preview-portable.html');await copyFile(join(out,'preview-portable.html'),portable);
 const standalone=await browser.newPage({viewport:{width:1200,height:950}});const failures=[];
 standalone.on('requestfailed',request=>failures.push(request.url()));standalone.on('pageerror',error=>evidence.errors.push(error.message));
 await standalone.goto(pathToFileURL(portable).href);await standalone.waitForFunction(()=>window.sykaPreview?.phase==='question');await standalone.evaluate(()=>document.fonts.ready);
 assert.equal(await standalone.locator('.orb-mover canvas').count(),1);
 const before=await standalone.locator('.orb-mover canvas').screenshot();await standalone.waitForTimeout(450);const after=await standalone.locator('.orb-mover canvas').screenshot();assert.notEqual(before.toString('base64'),after.toString('base64'));
 const fonts=await standalone.evaluate(()=>[...document.fonts].map(f=>({family:f.family,status:f.status})));assert.ok(fonts.some(f=>f.family==='Inter'&&f.status==='loaded'));
 await standalone.getByRole('textbox',{name:'Tu respuesta'}).fill('Poético, con tipografía grande.');await standalone.getByRole('button',{name:'Continuar con mi respuesta'}).click();await standalone.waitForFunction(()=>!window.sykaPreview.pending);
 assert.equal(failures.length,0);evidence.portable={singleHtml:true,isolatedPath:portable,fontLoaded:true,animatedNativeOrb:true,answerWorks:true,failedRequests:failures};
 await standalone.close();assert.equal(evidence.errors.length,0);
 await writeFile(join(out,'comparison-verification.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence));
}finally{await browser.close();}
