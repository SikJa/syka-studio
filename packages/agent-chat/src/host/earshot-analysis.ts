/** Optional isolated Earshot semantic ranking; never starts on app launch/search. */
import { realpath, stat } from 'node:fs/promises';
import { analysisSource, mediaProcess } from './media-analysis';
import type { ToolSearch } from './local-tools';

export const EARSHOT_ANALYSIS_TOOL = {type:'function',name:'syka_earshot_analyze',
  description:'OPTIONAL local Earshot semantic ranking of 1–4 already shortlisted project SFX, each <=15 s. Status never starts Python or loads models. Rank requires explicit useModels:true AND an independently configured private SYKA_EARSHOT_PYTHON environment; no automatic installation, download, upload, paid service or fallback. Runs CPU-only/offline in a bounded subprocess which exits afterwards. Neural similarity is a suggestion, not premium-quality or listening approval. Normal sound search/launch kit does not use this tool.',
  inputSchema:{type:'object',additionalProperties:false,properties:{action:{type:'string',enum:['status','rank']},useModels:{type:'boolean'},query:{type:'string',minLength:1,maxLength:240},sources:{type:'array',minItems:1,maxItems:4,items:{type:'string'}}},required:['action']}};

export async function optionalEarshotAnalysis(cwd:string,raw:unknown,search?:ToolSearch,signal?:AbortSignal) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Argumentos Earshot requeridos.');
  const args=raw as Record<string,unknown>;
  if(Object.keys(args).some(k=>!['action','useModels','query','sources'].includes(k)))throw Error('Campo Earshot desconocido.');
  const configured=search?.env?.SYKA_EARSHOT_PYTHON??process.env.SYKA_EARSHOT_PYTHON;
  if(args.action==='status')return {configured:Boolean(configured),modelsLoaded:false,automaticDownloads:false,requiresExplicitUseModels:true,normalLibraryAndLaunchNeedModels:false,setup:'Optional isolated Earshot 0.4 Python environment with pre-cached models; set SYKA_EARSHOT_PYTHON to its executable. See syka-local-audio/references/earshot-launch.md.'};
  if(args.action!=='rank'||args.useModels!==true)throw Error('El análisis neuronal es opcional: requiere action:rank y useModels:true.');
  if(!configured)throw Error('Earshot neuronal no configurado. La biblioteca y launch siguen funcionando sin modelos; no se descargó nada.');
  if(typeof args.query!=='string'||!args.query.trim()||args.query.length>240||!Array.isArray(args.sources)||!args.sources.length||args.sources.length>4||!args.sources.every(p=>typeof p==='string')||new Set(args.sources).size!==args.sources.length)throw Error('Elegí una consulta y 1–4 SFX distintos del proyecto.');
  const python=await realpath(configured);if(!(await stat(python)).isFile())throw Error('Python Earshot inválido.');
  const paths=[];
  for(const source of args.sources) {
    const item=await analysisSource(cwd,source,search);
    const probe=JSON.parse((await mediaProcess(item.ffprobe,['-v','error','-show_streams','-show_format','-of','json',item.path],100000,15000,signal)).stdout.toString());
    const stream=probe.streams?.find((s:{codec_type:string})=>s.codec_type==='audio'),duration=Number(stream?.duration??probe.format?.duration);
    if(!stream||!Number.isFinite(duration)||duration<=0||duration>15)throw Error('Cada candidato debe tener audio y durar hasta 15 segundos.');
    paths.push(item.path);
  }
  const env={...process.env,...search?.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',CUDA_VISIBLE_DEVICES:'',EARSHOT_THREADS:'2',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',PYTHONUTF8:'1'};
  const result=await mediaProcess(python,['-m','earshot','rank',args.query,...paths,'--top',String(paths.length),'--threads','2','--json'],32000,90000,signal,env);
  const ranking=JSON.parse(result.stdout.toString());
  return {state:'ranked',ranking,modelsOptional:true,offline:true,subprocessFinished:true,requiresListening:true};
}
