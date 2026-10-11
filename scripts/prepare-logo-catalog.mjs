// Build an offline, attributed catalog from an explicitly supplied SVGL snapshot.
// Parse data literals only: never execute downloaded TypeScript.
import ts from 'typescript';
import {readFile,readdir,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join,basename,relative,isAbsolute,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];
if(!args.includes('--source-dir')||!args.includes('--commit'))throw Error('Use --source-dir <snapshot> --commit <sha>');
const source=resolve(get('--source-dir')),commit=get('--commit');
if(!/^[a-f0-9]{40}$/.test(commit))throw Error('A pinned upstream commit is required');
const output=join(repo,'docs/resources/logos');
const lobe=args.includes('--lobe-dir')?resolve(get('--lobe-dir')):null;
const text=await readFile(join(source,'src/data/svgs.ts'),'utf8');
const ast=ts.createSourceFile('svgs.ts',text,ts.ScriptTarget.Latest,true);
function literal(node){
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
 if(ts.isArrayLiteralExpression(node))return node.elements.map(literal);
 if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(p=>{
  if(!ts.isPropertyAssignment(p)||!(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name)))throw Error('Unsupported catalog expression');
  return [p.name.text,literal(p.initializer)];
 }));
 throw Error('Catalog must contain data literals only');
}
const declaration=ast.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations).find(d=>ts.isIdentifier(d.name)&&d.name.text==='svgs');
if(!declaration?.initializer)throw Error('Missing upstream catalog');
const brands=literal(declaration.initializer),entries=[],excluded=[],used=new Set();
const slug=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
await mkdir(output,{recursive:true});
for(const brand of brands){
 if(typeof brand.title!=='string'||typeof brand.url!=='string')throw Error('Invalid brand metadata');
 const folder=slug(brand.title);if(!folder)throw Error('Empty brand name');
 for(const [variant,value] of [['symbol',brand.route],['wordmark',brand.wordmark]]){
  if(!value)continue;
  for(const [theme,route] of typeof value==='string'?[['any',value]]:Object.entries(value)){
   const routePath=typeof route==='string'&&!route.startsWith('/')?'/'+route:route;
   if(typeof routePath!=='string'||!/^\/library\/[a-zA-Z0-9_.-]+\.svg$/.test(routePath)){excluded.push({brand:brand.title,route,reason:'Not a local SVG route'});continue;}
   const upstream=join(source,'static',routePath.slice(1)),bytes=await readFile(upstream),svg=bytes.toString('utf8');
   if(!/<svg[\s>]/i.test(svg)||/<(script|foreignObject)\b|\bon\w+\s*=|(?:href|url)\s*(?:=|\()\s*["']?\s*(?:https?:|javascript:|file:)/i.test(svg)||bytes.length>2*1024*1024){excluded.push(route);continue;}
   const path=folder+'/'+basename(route),target=resolve(output,path),rel=relative(output,target);
   if(isAbsolute(rel)||rel.startsWith('..'))throw Error('Catalog path escapes destination');
   if(used.has(path))continue;used.add(path);
   await mkdir(dirname(target),{recursive:true});
   try {const existing=await readFile(target);if(!existing.equals(bytes))throw Error('Existing catalog file differs: '+path);}
   catch(error){if(error.code!=='ENOENT')throw error;await writeFile(target,bytes,{flag:'wx'});}
   entries.push({path,provider:'SVGL',brand:brand.title,variant,theme,category:brand.category,url:brand.url,brandUrl:brand.brandUrl,
    upstreamPath:'static'+route,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
 }
}
await copyFile(join(source,'LICENSE'),join(output,'LICENSE-SVGL.txt'));
const sources=[{provider:'SVGL',repository:'https://github.com/pheralb/svgl',commit,license:'MIT'}];
if(lobe){
 const pkg=JSON.parse(await readFile(join(lobe,'package.json'),'utf8'));
 if(pkg.name!=='@lobehub/icons-static-svg'||pkg.license!=='MIT'||!/^\d+\.\d+\.\d+$/.test(pkg.version))throw Error('Invalid static LobeHub package');
 const titles=new Map(brands.map(b=>[slug(b.title).replaceAll('-',''),b.title]));
 for(const [key,title] of Object.entries({aistudio:'AI Studio',chatgpt:'ChatGPT',claude:'Claude',deepseek:'DeepSeek',huggingface:'Hugging Face',lobehub:'LobeHub',openai:'OpenAI',openrouter:'OpenRouter'}))titles.set(key,title);
 for(const file of (await readdir(join(lobe,'icons'))).sort()){
  if(!/^[a-z0-9-]+\.svg$/.test(file))continue;
  const id=file.replace(/\.svg$/,'').replace(/-(?:brand|text)(?:-cn)?(?:-color)?$|-color$/,'');
  const bytes=await readFile(join(lobe,'icons',file)),svg=bytes.toString('utf8');
  if(!/<svg[\s>]/i.test(svg)||/<(script|foreignObject)\b|\bon\w+\s*=|(?:href|url)\s*(?:=|\()\s*["']?\s*(?:https?:|javascript:|file:)/i.test(svg)||bytes.length>2*1024*1024){excluded.push({provider:'LobeHub',file,reason:'Not a passive SVG'});continue;}
  const path='lobehub/'+id+'/'+file,target=join(output,path);
  await mkdir(dirname(target),{recursive:true});
  try{const existing=await readFile(target);if(!existing.equals(bytes))throw Error('Existing catalog file differs: '+path);}
  catch(error){if(error.code!=='ENOENT')throw error;await writeFile(target,bytes,{flag:'wx'});}
  entries.push({path,provider:'LobeHub',brand:titles.get(id.replaceAll('-',''))??id[0].toUpperCase()+id.slice(1),variant:/-(?:text|brand)(?:-cn)?(?:-color)?\.svg$/.test(file)?'wordmark':'symbol',theme:'any',category:'AI',url:'https://lobehub.com/icons',upstreamPath:'icons/'+file,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 await copyFile(join(lobe,'LICENSE'),join(output,'LICENSE-LOBEHUB.txt'));
 sources.push({provider:'LobeHub',repository:'https://github.com/lobehub/lobe-icons',package:pkg.name,version:pkg.version,license:'MIT'});
}
await writeFile(join(output,'catalog.json'),JSON.stringify({version:1,sources,entries,excluded},null,2)+'\n');
await writeFile(join(output,'NOTICE.md'),'# Logos incluidos\n\n'+sources.map(s=>s.provider+': '+s.repository+(s.commit?'/tree/'+s.commit:'; paquete '+s.package+'@'+s.version)).join('\n\n')+'\n\nSe conservan los SVG originales, metadatos, hash y licencias MIT de las fuentes públicas. Las marcas pertenecen a sus titulares; usar estos recursos para identificar productos no implica afiliación ni permite registrar una marca ajena. Consultar `brandUrl` cuando esté disponible. Las bibliotecas personales conectadas por el usuario no forman parte de este catálogo.\n');
console.log(JSON.stringify({brands:new Set(entries.map(e=>e.brand.toLocaleLowerCase())).size,files:entries.length,bytes:(await Promise.all(entries.map(e=>readFile(join(output,e.path))))).reduce((n,b)=>n+b.length,0),excluded,sources}));
