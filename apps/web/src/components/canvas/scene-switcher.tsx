import { DropdownMenu as Menu } from '@kobalte/core/dropdown-menu';
import { For, Show, createMemo, createSignal, onCleanup } from 'solid-js';
import { useWorld } from '@diffusionstudio/koota-solid';
import { getEntityChildren, Scene, SceneView, Source, Name, Root, setActive, focusEntities, focusContent } from '@diffusionstudio/runtime';
import { useDerived } from '@/engine';
import { Icon } from '@/components/ui/icon';
import './scene-switcher.css';

export function SceneSwitcher() {
  const world = useWorld();
  const scenes = useDerived(() => getEntityChildren(world, world.get(Root)!).filter(e => e.has(Scene)));
  const view = useDerived(() => world.get(SceneView));
  const key = (scene: ReturnType<typeof scenes>[number]) => scene.get(Source)?.value || String(scene.id());
  const current = createMemo(() => scenes().find(s => key(s) === view()?.key) ?? scenes()[0]);
  const [open, setOpen] = createSignal(false);
  const [closing, setClosing] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const changeOpen = (next: boolean) => {
    clearTimeout(timer);
    setOpen(next);
    setClosing(!next);
    if (!next) {
      const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dropdown-close-dur')) || 150;
      timer = setTimeout(() => setClosing(false), duration);
    }
  };

  return <Show when={scenes().length > 1 || view()?.overview}><div class="syka-scene-switcher" role="group" aria-label="Vista de composiciones">
    <Menu open={open()} onOpenChange={changeOpen} forceMount placement="bottom" gutter={8} modal={false}>
      <Menu.Trigger class="syka-scene-trigger" aria-label="Composición visible" disabled={!current()}>
        <Icon name="scene-frame-small" class="size-4 text-muted-foreground" />
        <span class="truncate">{current()?.get(Name)?.value || 'Composición'}</span>
        <span class="syka-scene-badge">{current() === scenes()[0] ? 'Principal' : 'Escena'}</span>
        <span class="syka-scene-chevron" classList={{'is-expanded': open()}}><Icon name="chevron-down" class="size-4" /></span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content class="t-dropdown syka-scene-menu" data-origin="top-center" classList={{'is-open':open(),'is-closing':closing()}} aria-hidden={!open()} onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }}>
          <div class="syka-scene-menu-heading">Composiciones</div>
          <Menu.RadioGroup value={view()?.key || (current() ? key(current()!) : '')} onChange={value => {
            const scene = scenes().find(s => key(s) === value);
            if (!scene) return;
            world.set(SceneView, { key: value, overview: false });
            setActive(world, scene);
            focusEntities(world, [scene]);
          }}>
            <For each={scenes()}>{(scene, index) => <Menu.RadioItem class="syka-scene-option" value={key(scene)}>
              <Icon name="scene-frame-small" class="size-4 text-muted-foreground" />
              <span class="min-w-0 flex-1 truncate">{scene.get(Name)?.value || 'Composición'}</span>
              <span class="syka-scene-option-kind">{index() === 0 ? 'Principal' : 'Escena'}</span>
              <span class="syka-scene-check"><Menu.ItemIndicator><Icon name="confirm-check" class="size-4" /></Menu.ItemIndicator></span>
            </Menu.RadioItem>}</For>
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
    <button type="button" class="syka-scene-overview" aria-pressed={view()?.overview ?? false} aria-label={view()?.overview ? 'Volver al video' : 'Ver todos los lienzos'} onClick={() => {
      const overview = !world.get(SceneView)?.overview;
      world.set(SceneView, { overview });
      if (!overview) world.set(SceneView, { key: '' });
      else focusContent(world);
    }}>
      <Icon name={view()?.overview ? 'scene-frame-small' : 'view.grid'} class="size-4" />
      <span>{view()?.overview ? 'Volver al video' : 'Todos los lienzos'}</span>
    </button>
  </div></Show>;
}
