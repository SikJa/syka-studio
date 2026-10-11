import {describe,it,expect} from 'vitest';
import {webLinks,webPlatform,splitWebDraft,composeWebDraft,mergeWebDraft} from './web-links';
describe('web link identity',()=>{it('recognizes brands without trusting lookalike domains and retains other websites',()=>{
 expect(webPlatform('https://www.tiktok.com/@a/video/123')).toBe('tiktok');expect(webPlatform('https://x.com/a/status/123')).toBe('x');expect(webPlatform('https://instagram.com.evil.test/p/123')).toBeNull();
 expect(webLinks('Mirá https://example.com/a. y https://github.com/heygen-com/hyperframes')).toEqual(['https://example.com/a','https://github.com/heygen-com/hyperframes']);
 expect(webLinks('https://user:password@example.com')).toEqual([]);
})});

describe('compact reference drafts',()=>{
 it('detects new URLs below edited text while keeping earlier chips and the message body',()=>{
  const first='https://github.com/swamimalode07/rare-ui',second='https://x.com/a/status/123?s=46';
  const draft=mergeWebDraft('Mirá la animación.\n'+second,[first]);
  expect(draft).toEqual({text:'Mirá la animación.',links:[first,second]});
  expect(splitWebDraft(composeWebDraft(draft.text,draft.links))).toEqual(draft);
  expect(mergeWebDraft(composeWebDraft(draft.text,draft.links),[first])).toEqual(draft);
 });
 it('hides pasted URLs without losing query parameters or surrounding instructions',()=>{
  const url='https://www.instagram.com/p/DeLseDEmySU/?vrf=NTc4MTIwNjQ2YQ==';
  const draft=splitWebDraft('Copiá estos subtítulos.\n'+url);
  expect(draft).toEqual({text:'Copiá estos subtítulos.',links:[url]});
  expect(composeWebDraft(draft.text,draft.links)).toBe('Copiá estos subtítulos.\n'+url);
 });
 it('preserves spaces and blank lines while editing a draft containing hidden links',()=>{
  for(const text of ['hola ','hola\n','hola\n\n','']){
   const urls=['https://example.com/a','https://example.com/b'];
   expect(splitWebDraft(composeWebDraft(text,urls))).toEqual({text,links:urls});
  }
 });
 it('removes only the chosen URL and deduplicates repeated pasted references',()=>{
  const a='https://example.com/a',b='https://example.com/abc';
  const draft=splitWebDraft(`Mirá esto.\n${a}\n${b}\n${a}`);
  expect(draft.links).toEqual([a,b]);
  expect(splitWebDraft(composeWebDraft(draft.text,draft.links.filter(url=>url!==a)))).toEqual({text:'Mirá esto.',links:[b]});
 });
});
