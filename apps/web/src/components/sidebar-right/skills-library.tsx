import { LibraryPagination, LibraryPreview } from './library-ui';
import { PreviewIcon } from '@/components/canvas/preview-icon';
import { beginSkillDrag, endSkillDrag } from '@/agent-chat/skill-drag';
import {
  createResource,
  createEffect,
  createSignal,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
} from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { useProject } from '@/context/project';
import {
  ensureConnected,
  currentModel,
  send,
  setSidebarTab,
  blockedReason,
  chatState,
  activeChatId,
} from '@/agent-chat/store';
import { Button } from '@/components/ui/button';
import { SkillScopeSelect } from './skill-scope-select';
import { librarySkillFormat, matchesLibraryFormat } from './recipe-format';
import { t } from '@/i18n';

export function SkillsLibrary(props: {
  scope: () => string;
  preferences: string[];
}) {
  const project = useProject();
  const [format, setFormat] = createSignal('all');
  const [search,setSearch]=createSignal('');
  const [editing,setEditing]=createSignal<{name:string;path:string;bundled?:boolean}>();
  const [editName,setEditName]=createSignal(''),[content,setContent]=createSignal(''),[revision,setRevision]=createSignal<string>(),[editError,setEditError]=createSignal('');
  const openEditor=async(skill:{name:string;path:string;bundled?:boolean})=>{
    setBusy(true);setEditError('');
    try{const result=await mainBridge.call(MAIN_CHANNELS.SYKA_AGENT_SETTINGS,{action:'read-skill',name:skill.name,bundled:skill.bundled});setContent(result.content??'');setRevision(result.revision);setEditName(skill.bundled?skill.name.slice(0,65)+'-personal':skill.name);setEditing(skill);}
    catch(error){toast.error('No se pudo leer la skill',{description:String(error)});}finally{setBusy(false);}
  };
  const saveEditor=async()=>{
    const skill=editing();if(!skill)return;setBusy(true);setEditError('');
    try{
      let version=revision();
      if(skill.bundled){await mainBridge.call(MAIN_CHANNELS.SYKA_AGENT_SETTINGS,{action:'import-skill',name:editName(),source:skill.path});const copy=await mainBridge.call(MAIN_CHANNELS.SYKA_AGENT_SETTINGS,{action:'read-skill',name:editName()});version=copy.revision;setRevision(version);setEditing({...skill,name:editName(),bundled:false});}
      const nextContent=skill.bundled ? content().replace(/^(name:\s*).*$/m,(_,prefix)=>prefix+editName()) : content();
      setContent(nextContent);
      await mainBridge.call(MAIN_CHANNELS.SYKA_AGENT_SETTINGS,{action:'save-skill',name:editName(),content:nextContent,revision:version});
      setEditing(undefined);await refetch();toast.success('Skill guardada');
    }catch(error){setEditError(String(error));}finally{setBusy(false);}
  };
  onCleanup(endSkillDrag);

  const skillFormat = librarySkillFormat;
  const formatLabel = (skill: {name?:string;description:string;format?:'general'|'reels'|'youtube'}) => ({general:'Cualquier formato', reels:'Reels', youtube:'YouTube'})[skillFormat(skill)];
  const [busy, setBusy] = createSignal(false),
    [scope, setScope] = createSignal('scene');
  const [data, { refetch }] = createResource(async () =>
    window.desktop
      ? mainBridge.call(MAIN_CHANNELS.SYKA_AGENT_SETTINGS, { action: 'get' })
      : null,
  );
  onMount(() => {
    ensureConnected();
    const refresh = () => {
      void refetch();
    };
    window.addEventListener('focus', refresh);
    onCleanup(() => window.removeEventListener('focus', refresh));
  });
  let previousTurns = '';
  createEffect(() => {
    const turns = Object.values(chatState.chats)
      .map((c) => c.turnId ?? '')
      .filter(Boolean)
      .join(',');
    if (previousTurns && turns !== previousTurns) void refetch();
    previousTurns = turns;
  });
  const chat = async (
    mode: 'create' | 'edit' | 'run',
    skill?: { name: string; path: string; bundled?: boolean },
    idea?: string,
  ) => {
    setBusy(true);
    try {
      const model = currentModel();
      if(mode==='run' && scope()==='selection' && props.scope()==='Sin selección') throw Error('Seleccioná un clip o elegí Video completo antes de ejecutar la skill.');
      if (!model)
        throw Error(blockedReason() ?? 'Elegí un modelo conectado en el chat.');
      const context =
        scope() === 'selection'
          ? props.scope()
          : 'Composición principal activa, video completo';
      let prompt: string;
      if (mode === 'run')
        prompt = `Leé la receta del proyecto con syka_editing_recipe y la skill ${skill!.name} en ${skill!.path} usando syka_skills. Ejecutala en el proyecto actual; el pedido y esta skill elegida prevalecen sobre preferencias anteriores. Alcance: ${context}. Usá las herramientas reales del editor, conservá el original y Deshacer, trabajá dentro de la composición principal. Guardá solo decisiones acordadas y referencias reales en la receta. Verificá el resultado y explicá cualquier paso pendiente sin simularlo.`;
      else if (mode === 'edit' && skill!.bundled)
        prompt = `Ayudame a personalizar la base ${skill!.name} (${skill!.path}). Leela con syka_skills y conversemos qué resultado y estilo quiero cambiar. Alcance: ${context}. No cambies el video ni la base de Syka. Cuando acordemos las instrucciones, guardá una nueva skill con un nombre propio mediante syka_skills create. Conservá en ella las referencias a los recursos y scripts de la base, descubriéndola con syka_skills cuando se necesiten; no prometas scripts que no existan. Devolvé la ruta personal verificada.`;
      else
        prompt = `Ayudame a ${mode === 'edit' ? 'mejorar mi skill ' + skill!.name + ' (' + skill!.path + ')' : 'crear una skill reutilizable de edición' + (idea ? ': ' + idea : '')}. Guiame desde este chat: preguntame qué resultado, estilo, material y pasos quiero; no me hagas rellenar un formulario. Alcance actual: ${context}. ${props.preferences.length ? 'Mis ajustes recientes: ' + props.preferences.join('; ') + '.' : ''} Proponé las instrucciones para que las revise. Cuando acordemos el flujo, ${mode === 'edit' ? 'leé la skill con syka_skills y usá save con la revisión devuelta' : 'usá syka_skills create con name y content'} para guardarla en el perfil personal de Syka (${data()?.skillsRoot ?? ''}) y devolver el nombre y la ruta verificadas. Esto es creación de un flujo, no ejecución: no cambies el video todavía. No inventes servicios disponibles.`;
      setSidebarTab('chat');
      await send({
        projectId: project.id(),
        cwd: project.dir(),
        chatId: activeChatId(project.id()),
        text: prompt,
        attachments: [],
        model,
      });
    } catch (e) {
      toast.error('No se pudo abrir el flujo', { description: String(e) });
    } finally {
      setBusy(false);
    }
  };
  const description = (text: string) => {
    const line = text.match(/^description:\s*(.+)$/m)?.[1];
    if (!line) return 'Flujo reutilizable guardado en tu perfil';
    if (line.startsWith('"')) { try { return JSON.parse(line) as string; } catch {} }
    return line.replace(/^'|'$/g, '');
  };
  const skills = () => data.error ? [] : data()?.skills ?? [];
  const hasSkills = () => skills().length > 0;
  const visibleSkills = createMemo(() => skills().filter(skill => matchesLibraryFormat(skill, format()) && (skill.name+' '+skill.description).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().includes(search().normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase())).sort((a,b)=>Number(!!a.bundled)-Number(!!b.bundled)));
  const [offset,setOffset]=createSignal(0);
  createEffect(()=>{search();format();setOffset(0);});
  const pageOffset=()=>Math.min(offset(),Math.max(0,Math.ceil(visibleSkills().length/24)-1)*24);
  const skillPage=createMemo(()=>visibleSkills().slice(pageOffset(),pageOffset()+24));
  const isEmpty = () => !data.loading && !data.error && !!data() && !hasSkills();
  const groups = [
    { label: 'Mis skills', entries: () => skillPage().filter((skill) => !skill.bundled) },
    { label: 'Incluidas con Syka', entries: () => skillPage().filter((skill) => skill.bundled) },
  ];
  return (
    <>
      <label class="syka-search"><input aria-label="Buscar skills" placeholder="Buscar skills…" value={search()} onInput={event=>setSearch(event.currentTarget.value)}/></label>
      <LibraryPreview open={!!editing()} title={editing()?.bundled?'Personalizar skill':'Editar skill'} onClose={()=>{if(!busy())setEditing(undefined)}} footer={<button disabled={busy()||!content().trim()||!editName().trim()} onClick={()=>void saveEditor()}>{busy()?'Guardando…':'Guardar cambios'}</button>}>
        <Show when={editError()}><p role="alert">{editError()}</p></Show>
        <label class="syka-skill-editor-field">Nombre<input value={editName()} disabled={!editing()?.bundled||busy()} onInput={event=>setEditName(event.currentTarget.value)} maxlength={80}/></label>
        <label class="syka-skill-editor-field">Instrucciones · SKILL.md<textarea value={content()} disabled={busy()} onInput={event=>setContent(event.currentTarget.value)} spellcheck={false}/></label>
      </LibraryPreview>
      <Show when={isEmpty()}>
        <header class="syka-skills-intro">
          <h3>Tu biblioteca de skills</h3>
          <p>Armá tu manera de editar con Syka en el chat. Guardala acá y elegila para tu próximo video.</p>
          <Button class="w-full" disabled={!window.desktop || busy()} onClick={() => void chat('create')}>
            Crear con Syka
          </Button>
        </header>
      </Show>
      <Show when={hasSkills()}>
        <header class="syka-skills-library-header">
          <div><strong>Tu biblioteca</strong><small>{skills().length} skills disponibles</small></div>
          <button disabled={data.loading} onClick={() => void refetch()} aria-label="Actualizar skills">Actualizar</button>
        </header>
        <div class="syka-recipe-formats" role="group" aria-label="Recetas por tipo de video">
          <For each={[['all','Todas'],['reels','Reels'],['youtube','YouTube'],['general','Generales']]}>{([value,label]) =>
            <button aria-pressed={format() === value} onClick={() => setFormat(value!)}>{t(label)}</button>
          }</For>
        </div>
        <SkillScopeSelect value={scope()} selection={props.scope()} onChange={setScope} />
        <Show when={!visibleSkills().length && !data.loading}><p class="syka-panel-note" role="status">No hay skills específicas para este formato. Las de uso general están en «Generales».</p></Show>
      </Show>
      <Show when={data.error}>
        <p class="syka-panel-note" role="alert">No se pudo cargar la biblioteca. {String(data.error)}</p>
        <button class="syka-skills-retry" onClick={() => void refetch()}>Volver a intentar</button>
      </Show>
      <Show when={data.loading}><p class="syka-panel-note" role="status">Cargando skills…</p></Show>
      <LibraryPagination total={visibleSkills().length} offset={pageOffset()} size={24} onPage={setOffset}/>
      <For each={groups}>
        {(group) => (
          <Show when={group.entries().length}>
            <section class="syka-skills-group" aria-label={t(group.label)}>
              <div class="syka-skills-list-heading"><span>{t(group.label)}</span><span>{group.entries().length}</span></div>
              <For each={group.entries()}>
                {(skill) => (
                  <article class="syka-skill-card syka-saved-skill" draggable={!busy()} onDragStart={event=>{if(event.dataTransfer)beginSkillDrag(event.dataTransfer,{name:skill.name,path:skill.path,bundled:skill.bundled,scope:scope()==='selection'?props.scope():'Video completo'});}} onDragEnd={endSkillDrag} onDblClick={event=>{if(!(event.target as HTMLElement).closest('button'))void openEditor(skill);}}>
                    <div>
                      <strong>{skill.name}</strong>
                      <small>{skill.bundled ? 'Base Syka · personalizable' : 'Mi skill'} · {formatLabel(skill)}</small>
                      <small>{description(skill.description)}</small>
                    </div>
                    <div class="syka-skill-actions">
                      <Button size="small" variant="secondary" disabled={busy() || (scope() === 'selection' && props.scope() === 'Sin selección')} aria-label={'Ejecutar '+skill.name} onClick={() => void chat('run', skill)}><PreviewIcon name="play"/></Button>
                      <Button size="small" variant="ghost" disabled={busy()} onClick={()=>void openEditor(skill)}>Editar</Button>
                      <Button size="small" variant="ghost" disabled={busy()} onClick={() => void chat('edit', skill)}>Editar en chat</Button>
                    </div>
                  </article>
                )}
              </For>
            </section>
          </Show>
        )}
      </For>
      <LibraryPagination total={visibleSkills().length} offset={pageOffset()} size={24} onPage={setOffset}/>
      <Button
        variant="secondary"
        class="w-full"
        disabled={!window.desktop || busy()}
        onClick={async () => {
          setBusy(true);
          try {
            const source = await mainBridge.call(
              MAIN_CHANNELS.PROJECTS_PICK_FOLDER,
              undefined,
            );
            if (source) {
              await mainBridge.call(MAIN_CHANNELS.SYKA_AGENT_SETTINGS, {
                action: 'import-skill',
                source,
              });
              await refetch();
              toast.success('Skill importada');
            }
          } catch (e) {
            toast.error(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Importar skill
      </Button>
      <Show when={isEmpty()}>
        <div class="syka-section-label">Para empezar una conversación</div>
        <For each={['Mi estilo de subtítulos', 'Mi flujo para reels', 'Mis ajustes de edición']}>
          {(idea) => (
            <button class="syka-skill-card" disabled={!window.desktop || busy()} onClick={() => void chat('create', undefined, idea)}>
              <span><strong>{t(idea)}</strong><small>Definir y guardar con Syka</small></span>
            </button>
          )}
        </For>
      </Show>
      <Show when={!window.desktop}>
        <p class="syka-panel-note">La creación y ejecución requieren el puente del editor de escritorio.</p>
      </Show>
    </>
  );
}
