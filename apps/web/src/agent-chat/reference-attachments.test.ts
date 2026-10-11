import { describe, expect, it } from 'vitest';
import { referenceAttachment, referenceManifest } from './reference-attachments';

describe('reference attachments', () => {
 it('snapshots the exact selection and instruction independently of later edits', () => {
  const context={preset:{id:'effect-gaussianBlur',label:'Layer Blur',kind:'effect',value:'gaussianBlur'},timeSeconds:2.4,elements:[{key:'title',name:'Título'}]};
  const attachment=referenceAttachment('Conservá el texto y aplicá este efecto.',context,'data:image/png;base64,preview');
  context.elements[0].name='Otro';context.timeSeconds=9;
  expect(attachment.name).toBe('Layer Blur');
  const manifest=JSON.parse(referenceManifest([attachment])!);
  expect(manifest.references[0].context).toMatchObject({timeSeconds:2.4,elements:[{key:'title',name:'Título'}]});
  expect(manifest.references[0].instruction).toBe('Conservá el texto y aplicá este efecto.');
  expect(manifest.references[0]).not.toHaveProperty('previewUrl');
 });
 it('deduplicates the same choice while distinguishing targets and time', () => {
  const c={name:'Mismo efecto',timeSeconds:2,elements:[{key:'a'}]};
  expect(referenceAttachment('Usar',c).key).toBe(referenceAttachment('Usar',c).key);
  expect(referenceAttachment('Usar',c).key).not.toBe(referenceAttachment('Usar',{...c,timeSeconds:3}).key);
  expect(referenceAttachment('Usar',c).key).not.toBe(referenceAttachment('Usar',{...c,elements:[{key:'b'}]}).key);
 });
 it('keeps local component files and usage in the manifest without treating normal files as references', () => {
  const ref=referenceAttachment('Adaptar editable',{name:'Orbit',kind:'motions',path:'F:/motions/Orbit.mp4',componentPath:'F:/motions/Orbit.tsx',componentFiles:['F:/motions/Orbit.tsx','F:/motions/time.ts'],usage:'Use real images'});
  const manifest=JSON.parse(referenceManifest([ref,{key:'pdf',name:'manual.pdf',kind:'file',path:'F:/manual.pdf'}])!);
  expect(manifest.references).toHaveLength(1);
  expect(manifest.references[0].path).toBe('F:/motions/Orbit.mp4');
  expect(manifest.references[0].context.componentFiles).toHaveLength(2);
  expect(manifest.references[0].context.usage).toBe('Use real images');
  expect(referenceManifest([])).toBeNull();
 });
});
