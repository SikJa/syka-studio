export type WebPlatform='instagram'|'tiktok'|'x'|'youtube'|'facebook'|'linkedin';
export function webPlatform(value:string):WebPlatform|null {
 try {const h=new URL(value).hostname.toLowerCase().replace(/^www\./,'');
  const matches=(domain:string)=>h===domain||h.endsWith('.'+domain);
  if(matches('instagram.com'))return 'instagram';
  if(matches('tiktok.com'))return 'tiktok';
  if(matches('x.com')||matches('twitter.com'))return 'x';
  if(matches('youtube.com')||h==='youtu.be')return 'youtube';
  if(matches('facebook.com')||h==='fb.watch')return 'facebook';
  if(matches('linkedin.com'))return 'linkedin';
 }catch{}
 return null;
}
export function webLinks(text:string):string[]{return [...new Set((text.match(/https?:\/\/[^\s<>"']+/gi)??[]).map(v=>v.replace(/[),.!?;\]]+$/,'')))].filter(v=>{try{const u=new URL(v);return !u.username&&!u.password}catch{return false}});}

/** The raw draft remains the durable source; URLs are presented as removable chips. */
export function splitWebDraft(value:string):{text:string;links:string[]} {
 const links=webLinks(value);let text=value;
 for(const href of [...links].sort((a,b)=>b.length-a.length)){
  const escaped=href.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  text=text.replace(new RegExp('(?:\\r?\\n)?'+escaped,'g'),'');
 }
 return {text:text.replace(/\[([^\]\n]+)\]\(\s*\)/g,'$1'),links};
}
export function composeWebDraft(text:string,links:readonly string[]):string {
 const unique=[...new Set(links)];return unique.length?`${text}${text?'\n':''}${unique.join('\n')}`:text;
}

/** Merge a newly edited/pasted body with the reference chips already in the draft. */
export function mergeWebDraft(text:string,links:readonly string[]):{text:string;links:string[]} {
 const next=splitWebDraft(text);
 return {text:next.text,links:[...new Set([...links,...next.links])]};
}
