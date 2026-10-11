/** @jsxImportSource react */
import {useEffect,useState} from 'react';
import {Plus,ChevronRight,Search,LoaderCircle,MessageSquare,Folder,MoreHorizontal,Copy,Download,ExternalLink,PanelLeftClose} from 'lucide-react';
import {MetalFx} from 'metal-fx';
import {useComposerMetalAppearance} from '../../shared/use-metal-appearance';
import {AgentIdentityOrb} from './agent-identity-orb';
import { SYKA_ORB_STATE } from '@/lib/syka-brand';
import {useAgentProjects,useThreadView,AgentProjectsSection,ThreadViewMenu,ProjectActions} from './agent-projects';
import type {AgentThreadMessage} from './syka-contracts';
import './agent-workspace.css';
import {AgentMenuPanel} from './agent-menu-panel';
import {ChatProjectPicker} from './chat-project-picker';
type Thread={conversationId:string;title:string|null;updatedAt:string;status:'active'|'archived'};
type Props={projectId:string;selectedId:string|null;threads:Thread[];messages:AgentThreadMessage[];open:boolean;running:boolean;onClose:()=>void;onSelect:(id:string)=>void;onNew:()=>Promise<string|null>;onGuide:()=>void;onSkills:()=>void;onScheduled:()=>void;onExport:(id:string)=>void;onOpenWindow:(id:string)=>void};
export function SykaSessionRail(props:Props){
 useEffect(()=>{if(!props.open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')props.onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[props.open,props.onClose]);
 const agent={key:props.projectId,name:'Syka',orbState:SYKA_ORB_STATE,accent:'#a6b4c2'};
 const projects=useAgentProjects(props.projectId),threadView=useThreadView(props.projectId),metalAppearance=useComposerMetalAppearance();
 const historyOpen=props.open,sending=props.running,workingElsewhere=false,enabled=true,loading=false;
 const historySurface=false;const [surfaceFilter,setSurfaceFilter]=useState('all');
 const [threadSearch,setThreadSearch]=useState(''),[projectActionError,setProjectActionError]=useState('');
 const [threadMenu,setThreadMenu]=useState<{id:string;anchor:HTMLButtonElement}|null>(null);
 const selectedId=props.selectedId,detail={messages:props.messages};
 const visibleThreads=props.threads.filter(t=>(t.title??'').toLowerCase().includes(threadSearch.toLowerCase())&&(threadView.status==='all'||(projects.statuses[t.conversationId]??t.status)===threadView.status)).sort((a,b)=>threadView.order==='name'?(a.title??'').localeCompare(b.title??''): (Date.parse(a.updatedAt)-Date.parse(b.updatedAt))*(threadView.order==='oldest'?1:-1));
 const activeProjects=projects.projects.filter(p=>!p.archived).sort((a,b)=>Number(threadView.pinned.includes(b.id))-Number(threadView.pinned.includes(a.id)));
 const threadGroups=threadView.grouping==='list'?[{id:'all',name:'Conversaciones',threads:visibleThreads}]:[...activeProjects.map(p=>({id:p.id,name:p.name,threads:visibleThreads.filter(t=>projects.assignments[t.conversationId]===p.id)})),{id:'unassigned',name:'Sin proyecto',threads:visibleThreads.filter(t=>!activeProjects.some(p=>projects.assignments[t.conversationId]===p.id))}];
 const onSelectThread=props.onSelect;
 const createInProject=async()=>{try{await props.onNew();}catch{setProjectActionError('No se pudo crear el chat. Volvé a intentar.');}};const onCreateThread=async():Promise<string|undefined>=>{return (await props.onNew())??undefined;};
 const copyText=(text:string)=>navigator.clipboard.writeText(text),threadUrl=(_:string,id:string)=>`${window.location.origin}${window.location.pathname}${window.location.hash.split('?')[0]}?chat=${encodeURIComponent(id)}`;
 const exportConversation=()=>props.onExport(selectedId??'');
 const formatTime=(value:string)=>new Date(value).toLocaleDateString('es-AR');
 useEffect(()=>{if(!props.open)setThreadMenu(null);},[props.open]);
 void surfaceFilter;
 return (      <aside className="agent-thread-rail" aria-label={`Historial de ${agent.name}`} aria-hidden={!historyOpen} inert={!historyOpen ? true : undefined}>
        <header className="agent-thread-header">
          <AgentIdentityOrb agent={agent} variant="header" working={sending} />
          <span><strong>{agent.name}</strong></span>
          <div>
            <button type="button" aria-label="Cerrar sidebar" title="Cerrar sidebar" onClick={props.onClose}><PanelLeftClose size={15}/></button>
          </div>
        </header>
        <label className="agent-thread-search"><Search size={14}/><input value={threadSearch} onChange={(event) => setThreadSearch(event.target.value)} placeholder="Buscar conversaciones" /></label>
        {historySurface ? <nav className="agent-thread-surface-filter" aria-label="Tipo de conversaciones">{([ ["panorama", "Panorama"], ["reels", "Reels"], ["stories", "Historias"], ["analytics", "Analíticas"], ["all", "Todos"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={surfaceFilter === value} onClick={() => setSurfaceFilter(value)}>{label}</button>)}</nav> : null}
        <MetalFx className="agent-new-chat-metal" variant="button" preset="chromatic" strength={0.9} theme={metalAppearance.theme} paused={metalAppearance.reducedMotion} borderRadius={10}>
          <button className="agent-new-chat" type="button" disabled={!enabled || sending || workingElsewhere} onClick={() => void createInProject()} aria-label="Crear nuevo chat">
            <span aria-hidden="true"><Plus size={15} /></span><strong>Nuevo chat</strong><ChevronRight size={14} aria-hidden="true" />
          </button>
        </MetalFx>
        <a className="agent-scheduled-link" href="#" onClick={event=>{event.preventDefault();props.onScheduled();}}><span aria-hidden="true">◷</span>Programadas</a>
        <div className="agent-project-toolbar"><AgentProjectsSection state={projects} agentName={agent.name}/>{historyOpen&&<ThreadViewMenu view={threadView} groupIds={threadGroups.map(group => group.id)}/>}</div>
        {projectActionError || projects.error ? <p className="agent-project-error" role="alert">{projectActionError || projects.error}</p> : null}
        <div className={`agent-thread-list ${threadView.inbox ? "is-inbox-view" : "is-compact-view"}`}>
          {loading ? <p className="agent-thread-loading"><LoaderCircle size={15} /> Cargando conversaciones</p> : null}
          {!loading && visibleThreads.length === 0 ? (
            <div className="agent-thread-empty">
              <MessageSquare size={22} />
              <strong>{threadSearch || threadView.status !== "all" ? "No hay conversaciones con este filtro" : enabled ? "Sin conversaciones" : "Historial todavía no habilitado"}</strong>
              <span>{threadSearch || threadView.status !== "all" ? "Cambiá la búsqueda o el filtro de estado." : enabled ? `Creá la primera cuando quieras hablar con ${agent.name}.` : "La interfaz está preparada sin simular datos ni actividad."}</span>
            </div>
          ) : null}
          {threadGroups.map((group, groupIndex) => <section className="agent-chat-project-group" key={group.id}>
            {threadView.sections[group.id] && (groupIndex === 0 || threadView.sections[threadGroups[groupIndex - 1]!.id] !== threadView.sections[group.id]) ? <div className="agent-project-section-label">{threadView.sections[group.id]}</div> : null}{group.id !== "unassigned" ? <div className="agent-chat-project-title"><button type="button" aria-expanded={!threadView.collapsed.includes(group.id)} aria-label={`${threadView.collapsed.includes(group.id) ? "Expandir" : "Contraer"} ${group.name}`} onClick={() => threadView.toggle(group.id)}><ChevronRight size={13} className={threadView.collapsed.includes(group.id) ? "" : "is-open"}/>{group.id !== "all" ? <Folder size={14}/> : null}<span>{threadView.pinned.includes(group.id) ? "• " : ""}{group.name}</span></button>{historyOpen && activeProjects.find(project => project.id === group.id) ? <ProjectActions project={activeProjects.find(project => project.id === group.id)!} state={projects} view={threadView}/> : null}{activeProjects.some(project => project.id === group.id) ? <button type="button" title={`Nuevo chat en ${group.name}`} aria-label={`Nuevo chat en ${group.name}`} disabled={!enabled || sending || workingElsewhere} onClick={() => { projects.select(group.id); void (async () => { try { const id = await onCreateThread?.(); if (id) { if (historySurface) setSurfaceFilter(historySurface); await projects.change({ action: "assign", conversationId: id, projectId: group.id }); threadView.update({ collapsed: threadView.collapsed.filter(item => item !== group.id) }); } } catch { setProjectActionError("No se pudo agregar el chat al proyecto."); } })(); }}><Plus size={14}/></button> : null}</div> : null}
          {!threadView.collapsed.includes(group.id) && group.threads.map((thread) => <div className={`agent-thread-row ${selectedId === thread.conversationId ? "active" : ""}`} key={thread.conversationId}>
            <button type="button" className="agent-thread-open" onClick={() => onSelectThread?.(thread.conversationId)}><span><strong>{thread.title ?? "Conversación sin título"}</strong>{threadView.inbox ? <small><span>{projects.projects.find(project => project.id === projects.assignments[thread.conversationId])?.name ?? "Conversación"}</span><time dateTime={thread.updatedAt}>{formatTime(thread.updatedAt)}</time></small> : null}</span></button>
            <button type="button" className="agent-thread-more" aria-label={`Opciones de ${thread.title ?? "conversación"}`} aria-expanded={threadMenu?.id === thread.conversationId} onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (threadMenu?.id === thread.conversationId) { setThreadMenu(null); return; }
              setProjectActionError('');
              setThreadMenu({ id: thread.conversationId, anchor:event.currentTarget });
            }}><MoreHorizontal size={15}/></button>
            {historyOpen && threadMenu?.id === thread.conversationId ? <AgentMenuPanel anchor={threadMenu.anchor} label={`Acciones de ${thread.title ?? "conversación"}`} onDismiss={()=>setThreadMenu(null)}>
              <ChatProjectPicker state={projects} conversationId={thread.conversationId} title={thread.title??'conversación'} onAssigned={()=>setThreadMenu(null)} onError={()=>setProjectActionError('No se pudo mover el chat. Volvé a intentar.')}/>
              <button onClick={() => void copyText(threadUrl(agent.key, thread.conversationId)).then(() => setThreadMenu(null)).catch(()=>setProjectActionError('No se pudo copiar el enlace.'))}><Copy size={13}/>Copiar enlace</button>
              <button onClick={() => void copyText(thread.conversationId).then(() => setThreadMenu(null)).catch(()=>setProjectActionError('No se pudo copiar el ID.'))}><Copy size={13}/>Copiar ID</button>
              <i aria-hidden="true"/>
              <button disabled={selectedId !== thread.conversationId || !detail} onClick={() => { if (detail) exportConversation(); setThreadMenu(null); }}><Download size={13}/>Exportar conversación</button>
              <button onClick={() => { props.onOpenWindow(thread.conversationId); setThreadMenu(null); }}><ExternalLink size={13}/>Abrir ventana</button>
            </AgentMenuPanel> : null}
          </div>)}
          </section>)}
        </div>
      </aside>
 );
}
