/** @jsxImportSource react */
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {BRAND_MARKS,BRAND_BY_ID,resolveToolBrand} from './catalog';
import {BrandMark,ToolBrandMark} from './brand-mark';
import type {LogoState} from './vendor/logoPresets';
import './gallery.css';

const states:Record<LogoState,string>={thinking:'Pensando',searching:'Buscando',working:'Trabajando',solving:'Resolviendo',listening:'Escuchando',waiting:'Esperando',generating:'Generando'};
const categories=[...new Set(BRAND_MARKS.map(mark=>mark.category))];
function Gallery() {
  const [selected,setSelected]=useState('youtube'),[query,setQuery]=useState(''),[category,setCategory]=useState('Todas');
  const [state,setState]=useState<LogoState>('searching'),[playing,setPlaying]=useState(true),[all,setAll]=useState(true);
  const [hovered,setHovered]=useState<string|null>(null),[dark,setDark]=useState(true),[onlyNew,setOnlyNew]=useState(false);
  const [status,setStatus]=useState('started');
  const mark=BRAND_BY_ID.get(selected)!;
  const filtered=BRAND_MARKS.filter(mark=>(!onlyNew||mark.added)&&(category==='Todas'||mark.category===category)&&`${mark.name} ${mark.aliases.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const activity={toolName:`mcp__${mark.aliases[0]}__search`,label:`Consultando ${mark.name}`,state:status};
  const routed=resolveToolBrand(activity);
  const choose=(id:string)=>{setSelected(id);setStatus('started');};
  return <main className="logo-gallery" data-theme={dark?'dark':'light'}>
    <header className="gallery-top"><a className="gallery-wordmark" href="/thinking-logos.html"><BrandMark id="syka" size={26}/>SYKA<span>STUDIO / LAB</span></a><button className="quiet-button" onClick={()=>setDark(value=>!value)}>{dark?'Modo claro':'Modo oscuro'}</button></header>
    <section className="gallery-heading"><div><p className="eyebrow">IDENTIDAD EN MOVIMIENTO</p><h1>Cada herramienta,<br/><span>a su ritmo.</span></h1><p className="intro">Una señal clara de dónde está trabajando tu agente.<br/>Explorá los logos y probá cómo se transforman.</p></div><div className="gallery-numbers"><b>110<span>identidades</span></b><b>07<span>movimientos</span></b><b>40<span>nuevas</span></b></div></section>
    <section className="gallery-stage" aria-label="Vista previa seleccionada">
      <div className="stage-identity"><p className="eyebrow">EN PRIMER PLANO</p><h2>{mark.name}</h2><p>{mark.category.replace('Ampliación · ','')}</p>{mark.kind==='functional'?<small>Símbolo funcional de Syka, no logo oficial.</small>:null}<div className="stage-actions"><button className="filled-button" onClick={()=>setPlaying(value=>!value)}>{playing?'Pausar':'Reproducir'}</button><select aria-label="Estado de la animación" value={state} onChange={event=>setState(event.target.value as LogoState)}>{Object.entries(states).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div></div>
      <div className="stage-orb"><BrandMark key={selected} id={selected} active={playing} state={state} size={148} theme={dark?'dark':'light'}/><span className="stage-caption">{playing?states[state]:'En pausa'}</span></div>
      <div className="stage-sizes"><p className="eyebrow">EN TU INTERFAZ</p><div className="actual-sizes">{[48,64,96].map(size=><div key={size}><BrandMark id={selected} state={state} active={playing} size={size} theme={dark?'dark':'light'}/><small>{size} px</small></div>)}</div><div className="activity-example"><small>EJEMPLO DE ACTIVIDAD</small><div><ToolBrandMark activity={activity} size={48}/><span>{status==='failed'?'La herramienta informó un error':status==='completed'?'Consulta completada':`Consultando ${routed.mark.name}`}</span></div><div className="status-options" role="group" aria-label="Estado de la herramienta">{[['started','En curso'],['completed','Completada'],['failed','Error']].map(([value,label])=><button key={value} aria-pressed={status===value} onClick={()=>setStatus(value)}>{label}</button>)}</div></div></div>
    </section>
    <section className="gallery-library" aria-label="Biblioteca de logos"><div className="library-heading"><h2>La biblioteca<span>{filtered.length}</span></h2><label className="motion-switch"><input type="checkbox" checked={all} onChange={event=>setAll(event.target.checked)}/>Animar visibles</label></div><div className="library-filters"><input type="search" placeholder="Buscá una aplicación…" aria-label="Buscar aplicación" value={query} onChange={event=>setQuery(event.target.value)}/><select aria-label="Categoría" value={category} onChange={event=>setCategory(event.target.value)}><option>Todas</option>{categories.map(value=><option key={value}>{value}</option>)}</select><button className="filter-new" aria-pressed={onlyNew} onClick={()=>setOnlyNew(value=>!value)}>Las 40 nuevas</button></div>
      <div className="logo-grid">{filtered.map(item=><button key={item.id} className="logo-card" aria-label={`Ver ${item.name}`} aria-pressed={selected===item.id} onClick={()=>choose(item.id)} onMouseEnter={()=>setHovered(item.id)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(item.id)} onBlur={()=>setHovered(null)}><span className="card-mark"><BrandMark id={item.id} active={all||hovered===item.id} state={state} size={52} theme={dark?'dark':'light'}/></span><strong>{item.name}</strong><small>{item.added?'NUEVO':item.kind==='functional'?'SÍMBOLO PROPIO':item.category}</small></button>)}</div>{filtered.length===0?<p className="empty-result">No hay aplicaciones con ese nombre.</p>:null}</section>
    <footer className="gallery-footer"><span>SYKA STUDIO · 110 IDENTIDADES</span><p>Las animaciones se detienen fuera de pantalla y respetan el movimiento reducido.</p><a href="https://github.com/enesozturk/thinking-logos" target="_blank" rel="noreferrer">Thinking Logos ↗</a></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Gallery/>);

