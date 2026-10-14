import type { LogoPointSet, LogoStyle, ShellMode } from './vendor/engine/cloud';

type PackedPoints = {version:1;n:number;p:number[];e:number[];style:LogoStyle;shell:ShellMode};
export type MarkAsset = {svg:string;markSvg:string;monochrome:boolean;small:PackedPoints;large:PackedPoints};
const imports = import.meta.glob<{default:MarkAsset}>('./data/*.json');
const loaded = new Map<string,Promise<MarkAsset>>();
export function loadMarkAsset(id:string):Promise<MarkAsset> {
  const existing = loaded.get(id); if(existing) return existing;
  const importer = imports[`./data/${id}.json`];
  if(!importer) return Promise.reject(new Error(`Unknown mark: ${id}`));
  const promise=importer().then(module=>module.default).catch(error=>{loaded.delete(id);throw error;});
  loaded.set(id,promise);return promise;
}
const unpacked = new WeakMap<PackedPoints,LogoPointSet>();
export function unpackPoints(points:PackedPoints):LogoPointSet {
  const existing=unpacked.get(points);if(existing)return existing;
  const value:LogoPointSet={...points,p:Float32Array.from(points.p),e:Float32Array.from(points.e)};
  unpacked.set(points,value);return value;
}
