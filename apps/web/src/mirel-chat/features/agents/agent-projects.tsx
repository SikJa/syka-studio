/** @jsxImportSource react */
import { useEffect, useRef, useState } from "react";
import { Folder, FolderPlus, X, Archive, RotateCcw, MoreHorizontal, Check, ChevronRight, Pin, Pencil, List } from "lucide-react";
import "./agent-projects.css";
import { AgentMenuPanel } from './agent-menu-panel';
import {readProjectSnapshot,readThreadView} from './agent-project-state';

export type AgentChatProject = { id: string; name: string; archived: boolean };
type Snapshot = { projects: AgentChatProject[]; assignments: Record<string, string> };
const empty = (): Snapshot => ({ projects: [], assignments: {} });
type Action = { action: "create" | "rename" | "archive" | "restore" | "assign" | "remove" | "archive_chats" | "restore_chats"; id?: string; name?: string; conversationId?: string; projectId?: string | null };
export function useAgentProjects(agentKey: string) {
  const preview = true; // Syka local persistence; never call Mirel API.
  const key = `syka:chat-projects:v1:${agentKey}`;
  const statusKey = `syka:chat-project-statuses:v1:${agentKey}`;
  const [data, setData] = useState<Snapshot>(empty), [selected, select] = useState<string | null>(null);
  const [loadedAgent, setLoadedAgent] = useState(agentKey);
  const [statuses, setStatuses] = useState<Record<string, "active" | "archived">>({});
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const scope = useRef(agentKey); scope.current = agentKey;
  const locked = useRef(false);
  const load = async () => {
    const current = agentKey;
    try {
      let next: Snapshot;
      if (preview) { next = readProjectSnapshot(localStorage.getItem(key)); }
      else { const response = await fetch(`/api/v1/agents/${agentKey}/projects`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? "No se pudieron cargar los proyectos."); next = payload.data; }
      if (scope.current === current) { setData(next); setLoadedAgent(current); setReady(true); setError(""); }
      if (scope.current === current) { try { const saved=JSON.parse(localStorage.getItem(statusKey)??'{}');setStatuses(Object.fromEntries(Object.entries(saved??{}).filter((entry):entry is [string,'active'|'archived']=>entry[1]==='active'||entry[1]==='archived'))); } catch { setStatuses({}); } }
    } catch (reason) { if (scope.current === current) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los proyectos."); }
  };
  useEffect(() => { setData(empty()); setStatuses({}); select(null); setReady(false); setError(""); void load(); const refresh=(event:StorageEvent)=>{if(event.key===key||event.key===statusKey)void load();};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh); }, [agentKey]);
  const change = async (action: Action) => {
    if (locked.current || !ready || loadedAgent !== agentKey) throw new Error("Esperá a que terminen de cargar los proyectos.");
    locked.current = true; setBusy(true); setError("");
    try {
      let next: Snapshot;
      if (preview) {
        const latest=readProjectSnapshot(localStorage.getItem(key));
        next = { projects: [...latest.projects], assignments: { ...latest.assignments } };
        if(action.action==='assign'&&action.projectId&&!next.projects.some(project=>project.id===action.projectId&&!project.archived))throw Error('Ese proyecto ya no está disponible. Actualizá la lista.');
        if (action.action === "remove") { next.projects = next.projects.filter(project => project.id !== action.id); next.assignments = Object.fromEntries(Object.entries(next.assignments).filter(([, id]) => id !== action.id)); }
        else if (action.action === "archive_chats" || action.action === "restore_chats") {
          const saved = JSON.parse(localStorage.getItem(statusKey) ?? '{}');
          const ids = Object.keys(next.assignments).filter(id => next.assignments[id] === action.id);
          localStorage.setItem(statusKey, JSON.stringify({ ...saved, ...Object.fromEntries(ids.map(id => [id, action.action === 'archive_chats' ? 'archived' : 'active'])) }));
        }
        else if (action.action === "create") next.projects.push({ id: crypto.randomUUID(), name: action.name!.trim(), archived: false });
        else if (action.action === "assign") { if (action.projectId) next.assignments[action.conversationId!] = action.projectId; else delete next.assignments[action.conversationId!]; }
        else next.projects = next.projects.map(project => project.id !== action.id ? project : { ...project, ...(action.action === "rename" ? { name: action.name!.trim() } : { archived: action.action === "archive" }) });
        localStorage.setItem(key, JSON.stringify(next));
      } else {
        const response = await fetch(`/api/v1/agents/${agentKey}/projects`, { method: "POST", headers: { "content-type": "application/json", "x-mirel-project-write": "1" }, body: JSON.stringify(action) });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? "No se pudo guardar el proyecto."); next = payload.data;
      }
      if (scope.current === agentKey) {
        setData(next);
        if (action.action === "archive_chats" || action.action === "restore_chats") {
          const ids = (next as Snapshot & { changedConversationIds?: string[] }).changedConversationIds ?? Object.keys(next.assignments).filter(id => next.assignments[id] === action.id);
          setStatuses(current => ({ ...current, ...Object.fromEntries(ids.map(id => [id, action.action === "archive_chats" ? "archived" : "active"])) }));
        }
        if (action.action === "archive" && action.id === selected) select(null);
      }
      return next;
    } catch (reason) { if (scope.current === agentKey) setError(reason instanceof Error ? reason.message : "No se pudo guardar."); throw reason; }
    finally { locked.current = false; if (scope.current === agentKey) setBusy(false); }
  };
  const sameAgent = loadedAgent === agentKey;
  return { ...(sameAgent ? data : empty()), statuses: sameAgent ? statuses : {}, selected: sameAgent ? selected : null, select, error: sameAgent ? error : "", busy, ready: sameAgent && ready, preview, change, reload: load };
}
export type AgentProjectsState = ReturnType<typeof useAgentProjects>;
export function useThreadView(agentKey: string) {
  const defaults = readThreadView(null);
  const read = () => {try{return readThreadView(localStorage.getItem(`syka:thread-view:${agentKey}`));}catch{return defaults;}};
  const [view, setView] = useState(read);
  useEffect(() => { setView(read());const refresh=(event:StorageEvent)=>{if(event.key===`syka:thread-view:${agentKey}`)setView(read());};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh); }, [agentKey]);
  const update = (patch: Partial<typeof defaults>) => setView(current => { const next = { ...current, ...patch }; try { localStorage.setItem(`syka:thread-view:${agentKey}`, JSON.stringify(next)); } catch {} return next; });
  return { ...view, update, toggle: (id: string) => update({ collapsed: view.collapsed.includes(id) ? view.collapsed.filter(item => item !== id) : [...view.collapsed, id] }) };
}
export function ThreadViewMenu({ view, groupIds }: { view: ReturnType<typeof useThreadView>; groupIds: string[] }) {
  const [panel, setPanel] = useState<"grouping" | "order" | "status" | null>(null);
  const [opened,setOpened]=useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const options = { grouping: [["project", "Por proyecto"], ["list", "En una sola lista"]], order: [["updated", "Más recientes"], ["oldest", "Más antiguos"], ["name", "Nombre A–Z"]], status: [["all", "Todas"], ["active", "Activas"], ["archived", "Archivadas"]] };
  return <><button ref={menu} className="agent-menu-trigger" aria-label="Organizar conversaciones" aria-expanded={opened} onClick={()=>{setPanel(null);setOpened(value=>!value);}}><MoreHorizontal size={18}/></button>{opened&&menu.current&&<AgentMenuPanel anchor={menu.current} label="Organizar conversaciones" onDismiss={()=>{setOpened(false);setPanel(null);}}>
    {([["grouping", "Organizar barra"], ["order", "Ordenar chats"], ["status", "Estado"]] as const).map(([key, label]) => <div key={key}><button type="button" aria-expanded={panel === key} onClick={()=>setPanel(panel===key?null:key)}><span>{label}</span><ChevronRight size={14}/></button>{panel===key&&<div className="agent-menu-options">{options[key].map(([value,text])=><button key={value} aria-pressed={view[key]===value} onClick={event=>{const trigger=event.currentTarget.parentElement?.previousElementSibling as HTMLButtonElement|null;view.update({[key]:value,...(key==='grouping'?{collapsed:[]}: {})});setPanel(null);trigger?.focus();}}><span>{text}</span>{view[key]===value&&<Check size={14}/>}</button>)}</div>}</div>)}
    <button type="button" aria-pressed={view.inbox} onClick={() => view.update({ inbox: !view.inbox })}><span>Estilo Inbox</span>{view.inbox ? <Check size={14}/> : null}</button>
    <button type="button" onClick={() => view.update({ collapsed: [...new Set([...groupIds, "all", "unassigned"])] })}>Contraer todo</button><button type="button" onClick={() => view.update({ collapsed: [] })}>Expandir todo</button>
    <button type="button" onClick={() => {view.update({ grouping: "project", order: "updated", inbox: true, status: "all", collapsed: [] });setPanel(null);}}>Restablecer vista</button>
  </AgentMenuPanel>}</>;
}
export function AgentProjectsSection({ state, agentName }: { state: AgentProjectsState; agentName: string }) {
  const [open, setOpen] = useState(false), [name, setName] = useState(""), [editing, setEditing] = useState<string | null>(null), [archived, setArchived] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <div className="agent-project-section">
    <button className="agent-project-heading" type="button" onClick={() => setOpen(true)}><Folder size={15}/><span>Proyectos</span><FolderPlus size={14}/></button>
    <dialog ref={dialog} className="agent-project-dialog" onKeyDown={event=>event.stopPropagation()} onKeyUp={event=>event.stopPropagation()} onCancel={() => setOpen(false)}>
      <header><div><h2>Proyectos de {agentName}</h2><p>{state.preview ? "Guardado localmente en Syka" : "Organizá tus conversaciones con este agente."}</p></div><button type="button" aria-label="Cerrar proyectos" onClick={() => setOpen(false)}><X size={18}/></button></header>
      {state.error ? <p role="alert">{state.error} <button type="button" onClick={() => void state.reload()}>Reintentar</button></p> : null}
      <form onSubmit={event => { event.preventDefault(); if (!name.trim()) return; void state.change({ action: editing ? "rename" : "create", ...(editing ? { id: editing } : {}), name: name.trim() }).then(() => { setName(""); setEditing(null); }).catch(() => {}); }}>
        <input aria-label="Nombre del proyecto" placeholder={editing ? "Nuevo nombre" : "Nombre del proyecto"} maxLength={80} value={name} onChange={event => setName(event.target.value)}/><button type="submit" disabled={state.busy || !state.ready || !name.trim()}>{editing ? "Guardar" : "Crear"}</button>{editing ? <button type="button" onClick={() => { setEditing(null); setName(""); }}>Cancelar</button> : null}
      </form>
      <nav><button type="button" aria-pressed={!archived} onClick={() => setArchived(false)}>Activos</button><button type="button" aria-pressed={archived} onClick={() => setArchived(true)}>Archivados</button></nav>
      <div className="agent-project-manager-list">{state.projects.filter(project => project.archived === archived).map(project => <article key={project.id}><Folder size={17}/><strong>{project.name}</strong><button type="button" disabled={state.busy} onClick={() => { setEditing(project.id); setName(project.name); }}>Renombrar</button><button type="button" disabled={state.busy} aria-label={`${archived ? "Restaurar" : "Archivar"} ${project.name}`} title={archived ? "Restaurar" : "Archivar sin borrar chats"} onClick={() => void state.change({ action: archived ? "restore" : "archive", id: project.id }).catch(() => {})}>{archived ? <RotateCcw size={15}/> : <Archive size={15}/>}</button></article>)}</div>
      <p className="agent-project-note">Archivar un proyecto conserva sus chats en «Todos los chats».</p>
    </dialog>
  </div>;
}

export function ProjectActions({ project, state, view }: { project: AgentChatProject; state: AgentProjectsState; view: ReturnType<typeof useThreadView> }) {
  const [mode, setMode] = useState<"rename" | "section" | "remove" | "archive_chats" | null>(null);
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), menu = useRef<HTMLButtonElement>(null);
  const pinned = view.pinned.includes(project.id);
  useEffect(() => { if (mode) dialog.current?.showModal(); else dialog.current?.close(); }, [mode]);
  const open = (next: typeof mode) => { setMenuOpen(false); setValue(next === "rename" ? project.name : view.sections[project.id] ?? ""); setMode(next); };
  return <>
    <button ref={menu} className="agent-menu-trigger agent-project-actions" aria-label={`Opciones del proyecto ${project.name}`} aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)}><MoreHorizontal size={16}/></button>{menuOpen && menu.current && <AgentMenuPanel anchor={menu.current} label={`Opciones del proyecto ${project.name}`} onDismiss={()=>setMenuOpen(false)}>
      <button type="button" onClick={() => { view.update({ pinned: pinned ? view.pinned.filter(id => id !== project.id) : [...view.pinned, project.id] }); setMenuOpen(false); }}><Pin size={14}/><span>{pinned ? "Desfijar" : "Fijar"}</span></button>
      <button type="button" onClick={() => open("rename")}><Pencil size={14}/><span>Editar</span></button>
      <button type="button" onClick={() => open("section")}><List size={14}/><span>Sección</span></button>
      <button type="button" onClick={() => open("archive_chats")}><Archive size={14}/><span>Archivar chats</span></button>
      <button type="button" disabled={state.busy} onClick={() => void state.change({ action: "restore_chats", id: project.id }).then(() => { view.update({ status: "active" }); setMenuOpen(false); }).catch(() => {})}><RotateCcw size={14}/><span>Restaurar chats</span></button>
      <button type="button" onClick={() => open("remove")}><X size={14}/><span>Quitar proyecto</span></button>
    </AgentMenuPanel>}
    <dialog ref={dialog} className="agent-project-dialog" onKeyDown={event=>event.stopPropagation()} onKeyUp={event=>event.stopPropagation()} onCancel={() => setMode(null)}>
      <header><h2>{mode === "rename" ? "Editar proyecto" : mode === "section" ? "Sección del proyecto" : mode === "remove" ? "Quitar proyecto" : "Archivar chats"}</h2><button type="button" aria-label="Cerrar acción de proyecto" onClick={() => setMode(null)}><X size={18}/></button></header>
      {mode === "remove" ? <p>Se quitará «{project.name}». Sus conversaciones se conservan en la lista de chats.</p> : mode === "archive_chats" ? <p>Los chats de «{project.name}» quedarán archivados. Podés recuperarlos con Restaurar chats.</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
      <form onSubmit={event => { event.preventDefault(); if (mode === "section") { view.update({ sections: { ...view.sections, [project.id]: value.trim() } }); setMode(null); return; } if (mode) void state.change({ action: mode, id: project.id, ...(mode === "rename" ? { name: value.trim() } : {}) }).then(() => { if (mode === "archive_chats") view.update({ status: "active" }); setMode(null); }).catch(() => {}); }}>
        {mode === "rename" || mode === "section" ? <input aria-label={mode === "rename" ? "Nombre del proyecto" : "Nombre de sección"} value={value} maxLength={80} placeholder={mode === "section" ? "Vacío para dejarlo sin sección" : "Nombre"} onChange={event => setValue(event.target.value)}/> : null}
        <button type="button" onClick={() => setMode(null)}>Cancelar</button><button type="submit" disabled={state.busy || (mode === "rename" && !value.trim())}>{mode === "remove" ? "Quitar" : mode === "archive_chats" ? "Archivar" : "Guardar"}</button>
      </form>
    </dialog>
  </>;
}



