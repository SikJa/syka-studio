import {
  createSignal,
  createMemo,
  createEffect,
  For,
  Show,
  onMount,
  onCleanup,
} from 'solid-js';
import { useWorld } from '@diffusionstudio/koota-solid';
import {
  Source,
  isAudio,
  isText,
  isCaption,
  Name,
  isScene,
  getActiveEntity,
} from '@diffusionstudio/runtime';
import { Captions } from '@diffusionstudio/reconciler';
import { toast } from 'somoto';
import { assetName } from '@diffusionstudio/assets';
import { useSelection, useAssetSelection, useEditor, useDerived } from '@/engine/hooks';
import { useLibrary } from '@/engine/library';
import { insertAsset } from '@/engine/insert-asset';
import { pickAndImport, pickFiles, importFiles } from '@/engine/asset-actions';
import { fontCatalogRevision, importNativeFonts } from '@/engine/fonts';
import { getEditHistory } from '@/engine/history';
import { ASSET_DRAG_TYPE } from '@/components/sidebar-left/folder-item';
import { AssetThumbnail } from '@/components/ui/asset-thumbnail';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Inspector, type InspectorSection } from './inspector';
import { SkillsLibrary } from './skills-library';
import { LinkedResources } from './linked-resources';
import { referenceInChat, selectionContext } from '@/agent-chat/visual-context';
import { useProject } from '@/context/project';
import {
  PROPERTY_SECTIONS,
  RESOURCE_DRAG_TYPE,
  RESOURCE_PREVIEW_DRAG_TYPE,
  type EditorResourceDrop,
} from './library-model';
import {
  EDITOR_RESOURCES,
  getEditorResources,
  applyEditorResource,
  resourceDisabledReason,
} from './resources';
import { PresetPreview } from './preset-preview';
import { AgentReferenceMenu } from './agent-reference-menu';
import { referenceThumbnail } from '@/agent-chat/reference-attachments';
import { t } from '@/i18n';
import './right-sidebar.css';

function SlidingTabs(props: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  let bar!: HTMLDivElement, pill!: HTMLSpanElement;
  let first = true;
  const sync = (animate = true) => {
    const button = bar?.querySelector<HTMLButtonElement>(
      '[aria-selected="true"]',
    );
    if (!button || !pill) return;
    if (!animate) pill.style.transition = 'none';
    pill.style.width = button.offsetWidth + 'px';
    pill.style.transform = `translateX(${button.offsetLeft}px)`;
    if (!animate) {
      void pill.offsetWidth;
      pill.style.transition = '';
    }
  };
  createEffect(() => {
    props.value;
    queueMicrotask(() => {
      sync(!first);
      first = false;
    });
  });
  onMount(() => {
    sync(false);
    const observer = new ResizeObserver(() => sync(false));
    observer.observe(bar);
    onCleanup(() => observer.disconnect());
  });
  return (
    <div
      ref={bar}
      class="syka-tabs t-tabs"
      role="tablist"
      aria-label={props.label}
    >
      <span ref={pill} class="t-tabs-pill" aria-hidden="true" />
      <For each={props.items}>
        {(item) => (
          <button
            role="tab"
            data-tour-target={`right-tab-${item.id}`}
            type="button"
            class="t-tab"
            aria-selected={props.value === item.id}
            tabIndex={props.value === item.id ? 0 : -1}
            onClick={() => props.onChange(item.id)}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
                return;
              e.preventDefault();
              const i = props.items.findIndex((x) => x.id === props.value);
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? props.items.length - 1
                    : (i +
                        (e.key === 'ArrowRight' ? 1 : -1) +
                        props.items.length) %
                      props.items.length;
              props.onChange(props.items[next].id);
              bar.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
            }}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  );
}
const categories = [
  { id: 'skills', get label() { return t('Skills y mis flujos'); } },
  { id: 'media', get label() { return t('Media'); } },
  { id: 'logos', get label() { return t('Logos'); } },
  { id: 'sounds', get label() { return t('Sonidos'); } },
  { id: 'motions', get label() { return t('Motions'); } },
  { id: 'text', get label() { return t('Texto'); } },
  { id: 'caption', get label() { return t('Subtítulos'); } },
  { id: 'font', get label() { return t('Fuentes'); } },
  { id: 'effect', get label() { return t('Efectos'); } },
  { id: 'animation', get label() { return t('Animación'); } },
  { id: 'transition', get label() { return t('Transiciones'); } },
  { id: 'style', get label() { return t('Estilo'); } },
];
export function RightSidebar() {
  const project = useProject();
  const world = useWorld(),
    editor = useEditor(),
    selection = useSelection(),
    assetSelection = useAssetSelection(),
    library = useLibrary();
  const previewName = useDerived(() => getActiveEntity(world)?.get(Name)?.value || 'Video');
  const [tab, setTab] = createSignal('properties'),
    [section, setSection] = createSignal<InspectorSection>('basic'),
    [category, setCategory] = createSignal('skills'),
    [query, setQuery] = createSignal('');
  const [picked, setPicked] = createSignal<string>(),
    [preferences, setPreferences] = createSignal<string[]>([]),
    [playing, setPlaying] = createSignal('');
  const identity = createMemo(
    () =>
      selection
        .nodes()
        .map((e) => e.id())
        .join(',') +
      '|' +
      selection
        .keyframes()
        .map((e) => e.id())
        .join(',') +
      '|' +
      (assetSelection.asset()?.id ?? assetSelection.partial()?.id ?? ''),
  );
  let previousIdentity = identity();
  createEffect(() => {
    const next = identity();
    if (next !== previousIdentity) {
      previousIdentity = next;
      setTab('properties');
      setSection(
        selection.first() && isAudio(selection.first()!) ? 'audio' : 'basic',
      );
    }
  });
  const scope = () =>
    selection.nodes().length
      ? selection
          .nodes()
          .map((e) => e.get(Source)?.value ?? String(e.id()))
          .join(', ')
      : 'Sin selección';
  const target = () => selection.first() ?? undefined;
  const title = () =>
    (assetSelection.asset()
      ? assetName(assetSelection.asset()!)
      : assetSelection.partial()?.path) ??
    (selection.keyframes().length
      ? 'Fotograma clave'
      : selection.nodes().length > 1
        ? `${selection.nodes().length} elementos`
        : (target()?.get(Name)?.value ?? 'Escena principal'));
  const typeLabel = () =>
    !target()
      ? 'Proyecto'
      : isAudio(target()!)
        ? 'Audio'
        : isCaption(target()!)
          ? 'Subtítulos'
          : isText(target()!)
            ? 'Texto'
            : isScene(target()!)
              ? 'Escena'
              : 'Elemento visual';
  const catalog = createMemo(() => {
    fontCatalogRevision();
    return getEditorResources();
  });
  const resources = createMemo(() =>
    catalog().filter(
      (r) =>
        (category() === 'style'
          ? r.kind === 'shadow' || r.kind === 'stroke'
          : r.kind === category()) &&
        r.label.toLowerCase().includes(query().toLowerCase()),
    ),
  );
  const selectedResource = () =>
    catalog().find((r) => r.id === picked());
  const disabledReason = (r: (typeof EDITOR_RESOURCES)[number]) =>
    selection.nodes().length
      ? selection
          .nodes()
          .map((e) => resourceDisabledReason(r, e))
          .find(Boolean)
      : resourceDisabledReason(r, undefined);
  const apply = (id: string, override?: EditorResourceDrop) => {
    const r = catalog().find((x) => x.id === id);
    if (!r) return;
    try {
      const t = override
        ? world.entities.find((e) => e.id() === override.targetId)
        : selection.nodes();
      applyEditorResource(world, r, t, override?.start);
      setTab('properties');
      setSection(
        r.kind === 'text' || r.kind === 'font' || r.kind === 'caption'
          ? 'basic'
          : r.kind === 'shadow' || r.kind === 'stroke'
            ? 'style'
            : r.kind === 'effect'
              ? 'effects'
              : r.kind,
      );
      toast.success(r.label + ' aplicado');
    } catch (e) {
      toast.error('No se pudo aplicar', { description: String(e) });
    }
  };
  onMount(() => {
    const off = editor.onEdit((edit) => {
      if (
        edit.kind !== 'prop' ||
        ![
          'fontSize',
          'fontFamily',
          'textAlign',
          'lineHeight',
          'letterSpacing',
          'opacity',
          'radius',
          'volume',
          'width',
          'height',
        ].includes(edit.name)
      )
        return;
      const text = edit.name + ': ' + JSON.stringify(edit.value);
      setPreferences((p) =>
        [...p.filter((v) => !v.startsWith(edit.name + ': ')), text].slice(-12),
      );
    });
    const drop = (e: Event) => {
      const detail = (e as CustomEvent<EditorResourceDrop>).detail;
      apply(detail.id, detail);
    };
    const click = (e: PointerEvent) => {
      if (
        e.target instanceof Element && e.target.closest('#timeline-canvas, [data-layer-row]') &&
        selection.nodes().length
      )
        setTab('properties');
    };
    window.addEventListener('syka-editor-resource-drop', drop);
    window.addEventListener('pointerup', click);
    onCleanup(() => {
      off();
      window.removeEventListener('syka-editor-resource-drop', drop);
      window.removeEventListener('pointerup', click);
    });
  });
  const chooseCategory = (id: string) => {
    setCategory(id);
    setQuery('');
    setPicked(undefined);
  };
  const importFonts = async () => {
    try {
      const result = await importNativeFonts();
      if (result.errors.length) toast.error('Algunas fuentes no se pudieron importar', { description: result.errors.join('\n') });
      else toast.success('Catálogo de fuentes actualizado');
    } catch (error) { toast.error(String(error)); }
  };
  const importCaptions = async () => {
    const lib = library();
    if (!lib) return;
    try {
      const assets = await importFiles(lib, await pickFiles({ accept: '.srt,.vtt,.json', multiple: false }), '');
      const asset = assets.find(a => a.type === 'TRANSCRIPT');
      if (assets.length && !asset) throw Error('Elegí un SRT, VTT o JSON con palabras y tiempos.');
      if (asset) {
        getEditHistory(world).command(() => insertAsset(world, asset));
        setTab('properties'); setSection('basic');
      }
    } catch (error) { toast.error('No se pudieron importar subtítulos', { description: String(error) }); }
  };
  const generateCaptions = () => {
    try {
      const parent = getActiveEntity(world);
      if (!parent || !isScene(parent)) throw Error('Abrí la escena que contiene el audio a subtitular.');
      getEditHistory(world).command(() => {
        const [caption] = editor.insertElement(parent, () => <Captions name="Subtítulos" preset="bridgeclip-subtle" />);
        if (caption) editor.select(caption);
      });
      setTab('properties'); setSection('basic');
      toast.success('Subtítulos agregados', { description: 'Syka usa el servicio de transcripción configurado para el audio de esta escena.' });
    } catch (error) { toast.error(String(error)); }
  };
  const chooseSection = (id: string) => {
    setSection(id as InspectorSection);
    setPicked(undefined);
  };
  return (
    <aside
      class="syka-right-sidebar"
      data-right-sidebar
      aria-label="Biblioteca y propiedades"
    >
      <header class="syka-panel-header">
        <span>Editor</span>
        <span class="text-muted-foreground" title={previewName()}>{previewName()}</span>
      </header>
      <SlidingTabs
        items={[
          { id: 'library', get label() { return t('Biblioteca'); } },
          { id: 'properties', get label() { return t('Propiedades'); } },
        ]}
        value={tab()}
        onChange={setTab}
        label="Panel del editor"
      />
      <Show
        when={tab() === 'properties'}
        fallback={
          <div class="syka-library-scroll">
            <nav
              class="syka-resource-categories"
              aria-label="Categorías de biblioteca"
            >
              <For each={categories}>
                {(c) => (
                  <button
                    classList={{
                      active: category() === c.id,
                      'syka-skills-category': c.id === 'skills',
                    }}
                    onClick={() => chooseCategory(c.id)}
                    aria-pressed={category() === c.id}
                  >
                    {c.label}
                  </button>
                )}
              </For>
            </nav>
            <Show
              when={category() === 'skills'}
              fallback={
                <>
                  <div class="syka-search">
                    <Icon name="search" class="size-4" />
                    <input
                      aria-label="Buscar recursos"
                      value={query()}
                      onInput={(e) => setQuery(e.currentTarget.value)}
                      placeholder="Buscar…"
                    />
                  </div>
                  <Show when={['logos', 'sounds', 'motions'].includes(category())} fallback={
                  <Show
                    when={category() === 'media'}
                    fallback={
                      <>
                        <Show when={category() === 'caption'}>
                          <div class="syka-library-actions">
                            <Button variant="secondary" disabled={!library()} onClick={() => void importCaptions()}>Importar SRT / VTT / JSON</Button>
                            <Button variant="secondary" onClick={generateCaptions}>Generar desde audio de escena</Button>
                          </div>
                        </Show>
                        <Show when={category() === 'font'}>
                          <Button variant="secondary" class="w-full mb-3" onClick={() => void importFonts()}>Importar fuentes OTF / TTF / TTC</Button>
                        </Show>
                        <p class="syka-panel-note">
                          {category() === 'caption'
                            ? 'Previews animados con texto de muestra. Aplicá el estilo a tus subtítulos o arrastrá la tarjeta al chat como referencia.'
                            : category() === 'font'
                              ? 'Elegí una fuente para tu texto o subtítulos. Las incluidas funcionan en otras instalaciones de Syka.'
                              : 'Previsualizá el preset en su tarjeta; aplicalo a la selección o arrastralo a un clip.'}
                        </p>
                        <div class="syka-resource-grid" classList={{ 'syka-type-resource-grid': ['caption', 'font', 'text'].includes(category()) }}>
                          <For each={resources()}>
                            {(r) => (
                              <AgentReferenceMenu onUse={(preview,origin) => referenceInChat(project.id(), 'Usá este preset como referencia visual para mi edición. Revisá la selección y proponé cómo adaptarlo.', {preset:{id:r.id,label:r.label,kind:r.kind,value:r.value,textStyle:r.textStyle},...selectionContext(world)}, preview,undefined,origin)}>
                              <button
                                class="syka-resource-card"
                                classList={{ selected: picked() === r.id }}
                                draggable="true"
                                onDragStart={(e) => {
                                  e.dataTransfer!.setData(
                                    RESOURCE_DRAG_TYPE,
                                    r.id,
                                  );
                                  e.dataTransfer!.effectAllowed = 'copy';
                                  const preview = referenceThumbnail(e.currentTarget);
                                  if (preview) e.dataTransfer!.setData(RESOURCE_PREVIEW_DRAG_TYPE, preview);
                                }}
                                onPointerEnter={() => setPlaying(r.id)}
                                onPointerLeave={() => setPlaying('')}
                                onFocus={() => setPlaying(r.id)}
                                onBlur={() => setPlaying('')}
                                onClick={() => setPicked(r.id)}
                                aria-label={'Previsualizar ' + r.label}
                              >
                                <span class="syka-resource-thumb">
                                  <PresetPreview
                                    resource={r}
                                    playing={playing() === r.id}
                                  />
                                </span>
                                <span>{r.label}</span>
                              </button>
                              </AgentReferenceMenu>
                            )}
                          </For>
                        </div>
                        <Show when={!resources().length}>
                          <p class="syka-panel-note">
                            No hay recursos para esta búsqueda.
                          </p>
                        </Show>
                        <Show when={selectedResource()}>
                          {(r) => (
                            <div class="syka-resource-detail">
                              <strong>{r().label}</strong>
                              <Show when={r().description}><p>{r().description}</p></Show>
                              <p>
                                {disabledReason(r()) ??
                                  (r().kind === 'transition'
                                    ? 'En el corte hacia el siguiente clip de la secuencia.'
                                    : 'Aplicación reversible en la selección actual.')}
                              </p>
                              <Button
                                class="w-full"
                                disabled={!!disabledReason(r())}
                                onClick={() => apply(r().id)}
                              >
                                {r().kind === 'text'
                                  ? 'Agregar texto'
                                  : 'Aplicar a selección'}
                              </Button>
                              <Button variant="secondary" class="w-full" onClick={() => referenceInChat(project.id(), 'Usá este preset como referencia visual para mi edición. Revisá la selección y proponé cómo adaptarlo.', {preset:{id:r().id,label:r().label,kind:r().kind,value:r().value,textStyle:r().textStyle},...selectionContext(world)}, referenceThumbnail(document.querySelector('.syka-resource-card.selected')))}>Usar con el agente</Button>
                            </div>
                          )}
                        </Show>
                      </>
                    }
                  >
                    <Button
                      variant="secondary"
                      class="w-full mb-3"
                      disabled={!library()}
                      onClick={() => {
                        const lib = library();
                        if (lib)
                          void pickAndImport(lib, '').catch((e) =>
                            toast.error(String(e)),
                          );
                      }}
                    >
                      Importar archivos
                    </Button>
                    <div class="syka-resource-grid">
                      <For
                        each={library()
                          ?.assets()
                          .filter((a) =>
                            assetName(a)
                              .toLowerCase()
                              .includes(query().toLowerCase()),
                          )}
                      >
                        {(asset) => (
                          <button
                            class="syka-resource-card"
                            draggable="true"
                            onDragStart={(e) => {
                              e.dataTransfer!.setData(
                                ASSET_DRAG_TYPE,
                                asset.id,
                              );
                              e.dataTransfer!.effectAllowed = 'copy';
                            }}
                            onClick={() => {
                              try {
                                const e = insertAsset(world, asset);
                                if (!e) throw Error('Abrí una escena.');
                                setTab('properties');
                              } catch (e) {
                                toast.error(String(e));
                              }
                            }}
                          >
                            <span class="syka-resource-thumb">
                              <AssetThumbnail
                                asset={asset}
                                cache={library()?.cache}
                                class="absolute inset-0"
                              />
                            </span>
                            <span>{assetName(asset)}</span>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                  }><LinkedResources kind={category() as 'logos' | 'sounds' | 'motions'} query={query()} onInserted={() => setTab('properties')} /></Show>
                </>
              }
            >
              <SkillsLibrary scope={scope} preferences={preferences()} />
            </Show>
          </div>
        }
      >
        <div class="syka-selection-heading">
          <strong>{title()}</strong>
          <span>
            {typeLabel()} ·{' '}
            {selection.nodes().length
              ? 'Selección actual'
              : 'Propiedades del proyecto'}
          </span>
        </div>
        <nav
          class="syka-property-categories"
          aria-label="Categorías de propiedades"
        >
          <For each={PROPERTY_SECTIONS}>
            {(c) => (
              <button
                classList={{ active: section() === c.id }}
                aria-pressed={section() === c.id}
                onClick={() => chooseSection(c.id)}
              >
                {c.label}
              </button>
            )}
          </For>
        </nav>
        <Show
          when={['style', 'effects', 'animation', 'transition'].includes(
            section(),
          )}
        >
          <button
            class="syka-browse-presets"
            onClick={() => {
              const value = section();
              setTab('library');
              chooseCategory(value === 'effects' ? 'effect' : value);
            }}
          >
            Ver presets en Biblioteca
            <Icon name="chevron-right" class="size-3" />
          </button>
        </Show>
        <div class="syka-inspector-content">
          <Show when={section()} keyed>
            {(value) => <Inspector section={value} />}
          </Show>
        </div>
        <Show
          when={
            preferences().length >= 3 &&
            localStorage.getItem('syka.skills.suggest') !== 'false'
          }
        >
          <Button
            variant="ghost"
            class="syka-save-preferences"
            onClick={() => {
              setTab('library');
              chooseCategory('skills');
            }}
          >
            Crear una skill con mis ajustes
          </Button>
        </Show>
      </Show>
    </aside>
  );
}
