/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { basename, dirname } from "@diffusionstudio/assets";
import { batch, createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { SidebarTabs } from "@/agent-chat";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toast } from "somoto";
import { t } from '@/i18n';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Breadcrumbs,
  BreadcrumbList,
  BreadcrumbsEllipsis,
  BreadcrumbsItem,
  BreadcrumbsLink,
  BreadcrumbsSeparator,
} from "../ui/breadcrumbs";
import { LazyAssetItem } from "./asset-item";
import { PartialAssetItem } from "./partial-asset-item";
import { FolderItem, handleFolderDrop, isAssetOrFolderDrag, ASSET_DRAG_TYPE, FOLDER_DRAG_TYPE } from "./folder-item";
import { useLibrary } from "@/engine/library";
import { useAssetSelection } from "@/engine/hooks";
import { droppedFiles, importFiles, pickAndImport, pickAndImportFolder } from "@/engine/asset-actions";
import { isInputTarget } from "@/utils";
import { clickedSelection, selectionIntersects, type SelectionRect } from './asset-selection';
import { useWorld } from '@diffusionstudio/koota-solid';
import { getEditHistory } from '@/engine/history';

import type { AssetLibrary } from "@diffusionstudio/assets";

/** The ancestors of a folder path, root excluded, nearest last. */
function ancestorsOf(path: string): string[] {
  const chain: string[] = [];
  for (let folder = path; folder; folder = dirname(folder)) chain.unshift(folder);
  return chain;
}

export function Assets() {
  let root: HTMLDivElement | undefined;
  let dragCounter = 0;
  let scroller: HTMLDivElement | undefined;
  let anchor: string | null = null;
  let suppressClick = false;
  let selectionDrag: { id: number; x: number; y: number; base: string[]; moved: boolean } | null = null;

  const library = useLibrary();
  const world = useWorld();
  const { id: selectedAssetId, select: setSelectedAssetId } = useAssetSelection();
  const [query, setQuery] = createSignal("");
  const [assetFilter, setAssetFilter] = createSignal<AssetFilter>("ALL");
  const [isDragging, setIsDragging] = createSignal(false);
  const [renamingFolder, setRenamingFolder] = createSignal<string | null>(null);
  const [currentFolder, setCurrentFolder] = createSignal("");
  const [selectedKeys, setSelectedKeys] = createSignal<string[]>([]);
  const [selectionBox, setSelectionBox] = createSignal<SelectionRect | null>(null);

  const allAssets = createMemo(() => library()?.list().filter((asset) => asset.type !== "SCRIPT") ?? []);
  const allPartials = createMemo(() => library()?.partials() ?? []);
  const allFolders = createMemo(() => [...(library()?.folders() ?? [])].sort());

  const activeFilterLabel = () => {
    const value = assetFilter();
    if (value === "ALL") return null;
    return ASSET_FILTER_OPTIONS.find((option) => option.value === value)?.label ?? null;
  };

  /** Whether an entry is in view: of the filtered type, matching the search, or in the open folder. */
  const isShown = (entry: { type: string; path: string }): boolean => {
    const q = query().trim().toLowerCase();
    const selectedFilter = assetFilter();
    if (selectedFilter !== "ALL" && entry.type !== selectedFilter) return false;
    if (q) return basename(entry.path).toLowerCase().includes(q);
    return dirname(entry.path) === currentFolder();
  };

  const filteredAssets = createMemo(() => allAssets().filter(isShown));
  const filteredPartials = createMemo(() => allPartials().filter(isShown));

  const visibleFolders = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (q) {
      return allFolders().filter((folder) => basename(folder).toLowerCase().includes(q));
    }
    return library()?.childrenOf(currentFolder()).folders ?? [];
  });

  const itemCount = createMemo(() => visibleFolders().length + filteredPartials().length + filteredAssets().length);
  const visibleKeys = createMemo(() => [
    ...visibleFolders().map(folder => `folder:${folder}`),
    ...filteredPartials().map(asset => asset.id), ...filteredAssets().map(asset => asset.id),
  ]);
  const selectedIds = () => selectedKeys().filter(key => !key.startsWith('folder:'));
  const selectKeys = (keys: string[]) => batch(() => {
    setSelectedKeys(keys);
    setSelectedAssetId(keys.find(key => !key.startsWith('folder:')) ?? null);
  });
  // The inspector keeps a primary item; external canvas selection can clear it.
  createEffect(() => {
    const id = selectedAssetId();
    if (id && !selectedKeys().includes(id)) setSelectedKeys([id]);
  });
  createEffect(() => {
    const visible = new Set(visibleKeys());
    const next = selectedKeys().filter(key => visible.has(key));
    if (next.length !== selectedKeys().length) selectKeys(next);
  });

  // Deep paths collapse like the breadcrumbs docs example:
  // All assets / … / parent / current, with the hidden folders in a dropdown.
  const folderPath = createMemo(() => ancestorsOf(currentFolder()));
  const collapsedFolders = createMemo(() => {
    const path = folderPath();
    return path.length > 2 ? path.slice(0, -2) : [];
  });
  const tailFolders = createMemo(() => {
    const path = folderPath();
    return path.length > 2 ? path.slice(-2) : path;
  });

  const openFolder = (path: string) => {
    selectKeys([]);
    anchor = null;
    setQuery("");
    setCurrentFolder(path);
  };

  const handleGoToParent = () => {
    if (currentFolder()) openFolder(dirname(currentFolder()));
  };

  // A folder that went away (deleted, moved) closes to the nearest one left.
  createEffect(() => {
    const folders = library()?.folders();
    let folder = currentFolder();
    if (!folders || !folder || folders.has(folder)) return;
    while (folder && !folders.has(folder)) folder = dirname(folder);
    setCurrentFolder(folder);
  });

  const withLibrary = (run: (library: AssetLibrary) => void | Promise<void>) => {
    const lib = library();
    if (!lib) {
      toast("No project open", { description: "Open a project to manage its assets." });
      return;
    }
    return run(lib);
  };

  const reportImportFailure = (error: unknown) => { toast.error('No se pudo guardar la importación', { description: (error as Error).message }); };
  const handleImportAssets = () => withLibrary((lib) => pickAndImport(lib, currentFolder()).then(() => {}, reportImportFailure));
  const handleImportFolder = () => withLibrary((lib) => pickAndImportFolder(lib, currentFolder()).then(() => {}, reportImportFailure));

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter = 0;
    setIsDragging(false);

    document.body.style.cursor = "default";

    const lib = library();
    if (!lib) return;
    if (handleFolderDrop(lib, event, currentFolder())) return;
    await importFiles(lib, droppedFiles(event), currentFolder()).catch(reportImportFailure);
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const isExternalFileDrag = (event: DragEvent) => {
    const types = event.dataTransfer?.types ?? [];
    return (
      types.includes("Files") &&
      !types.includes(ASSET_DRAG_TYPE) &&
      !types.includes(FOLDER_DRAG_TYPE)
    );
  };

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isExternalFileDrag(event)) return;
    dragCounter++;
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isExternalFileDrag(event)) return;
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      setIsDragging(false);
    }
  };


  const handleSelectAsset = (key: string, event?: MouseEvent) => {
    if (suppressClick) return;
    // Right-click keeps a multiple selection intact for its Delete action.
    if (event?.type === 'contextmenu' && selectedKeys().includes(key)) return;
    selectKeys(clickedSelection(visibleKeys(), selectedKeys(), key, anchor, event ?? {}));
    if (!event?.shiftKey) anchor = key;
    root?.focus();
  };

  const deleteSelected = async () => {
    const lib = library();
    if (!lib) return;
    const keys = [...selectedKeys()];
    try {
      const entries = keys.filter(key => !key.startsWith('folder:')).flatMap(id => lib.get(id) ?? lib.getPartial(id) ?? []);
      if (entries.length) await lib.remove(entries);
      for (const key of keys.filter(key => key.startsWith('folder:'))) await lib.deleteFolder(key.slice(7));
      selectKeys([]);
    } catch (error) { toast.error('No se pudieron quitar los recursos', { description: (error as Error).message }); }
  };

  const handleSelectionDown = (event: PointerEvent) => {
    if (event.button !== 0 || !scroller || (event.target instanceof Element && event.target.closest('[data-library-key],button,input,[role="menu"]'))) return;
    const bounds = scroller.getBoundingClientRect();
    selectionDrag = { id: event.pointerId, x: event.clientX - bounds.left + scroller.scrollLeft,
      y: event.clientY - bounds.top + scroller.scrollTop, base: event.ctrlKey || event.metaKey || event.shiftKey ? [...selectedKeys()] : [], moved: false };
    scroller.setPointerCapture(event.pointerId);
    root?.focus();
    event.preventDefault();
  };
  const handleSelectionMove = (event: PointerEvent) => {
    if (!selectionDrag || !scroller) return;
    const bounds = scroller.getBoundingClientRect();
    if (event.clientY > bounds.bottom) scroller.scrollTop += Math.min(24, event.clientY - bounds.bottom);
    else if (event.clientY < bounds.top) scroller.scrollTop -= Math.min(24, bounds.top - event.clientY);
    const x = event.clientX - bounds.left + scroller.scrollLeft, y = event.clientY - bounds.top + scroller.scrollTop;
    if (!selectionDrag.moved && Math.hypot(x - selectionDrag.x, y - selectionDrag.y) < 4) return;
    selectionDrag.moved = true;
    const box = { left: Math.min(x, selectionDrag.x), right: Math.max(x, selectionDrag.x),
      top: Math.min(y, selectionDrag.y), bottom: Math.max(y, selectionDrag.y) };
    setSelectionBox(box);
    const hits = [...scroller.querySelectorAll<HTMLElement>('[data-library-key]')].filter(item => {
      const rect = item.getBoundingClientRect();
      return selectionIntersects(box, { left: rect.left - bounds.left + scroller!.scrollLeft,
        right: rect.right - bounds.left + scroller!.scrollLeft, top: rect.top - bounds.top + scroller!.scrollTop,
        bottom: rect.bottom - bounds.top + scroller!.scrollTop });
    }).map(item => item.dataset.libraryKey!);
    selectKeys([...new Set([...selectionDrag.base, ...hits])]);
  };
  const handleSelectionUp = (event: PointerEvent) => {
    if (!selectionDrag) return;
    suppressClick = selectionDrag.moved;
    if (!selectionDrag.moved) selectKeys(selectionDrag.base);
    selectionDrag = null;
    setSelectionBox(null);
    if (scroller?.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
  };

  const moveSelection = (delta: number) => {
    const items = Array.from(
      root?.querySelectorAll<HTMLElement>("[data-asset-id]") ?? []
    );
    if (items.length === 0) return;

    const currentId = selectedAssetId();
    const currentIndex = currentId
      ? items.findIndex(item => item.dataset.assetId === currentId)
      : -1;
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = Math.min(
      items.length - 1,
      Math.max(0, baseIndex + delta)
    );

    const nextItem = items[nextIndex];
    const nextId = nextItem?.dataset.assetId;
    if (!nextId) return;

    selectKeys([nextId]);
    anchor = nextId;
    nextItem.scrollIntoView({ block: "nearest" });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable
    ) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault(); event.stopPropagation(); selectKeys([...visibleKeys()]); return;
    }
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.stopPropagation();
      const history = getEditHistory(world);
      if (event.shiftKey || event.key.toLowerCase() === 'y') history.redo(); else history.undo();
      return;
    }
    if (event.key === 'Escape') { selectKeys([]); return; }
    if (event.key === 'Enter' && selectedKeys().length === 1 && selectedKeys()[0].startsWith('folder:')) {
      event.preventDefault(); openFolder(selectedKeys()[0].slice(7)); return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      if (selectedKeys().length) {
        event.preventDefault();
        event.stopPropagation();
        void deleteSelected();
        return;
      }

      if (currentFolder()) {
        event.preventDefault();
        handleGoToParent();
      }

      return;
    }

    const columns = 2;
    const deltaByKey: Record<string, number> = {
      ArrowUp: -columns,
      ArrowDown: columns,
      ArrowLeft: -1,
      ArrowRight: 1,
    };
    const delta = deltaByKey[event.key];
    if (delta === undefined) return;

    event.preventDefault();
    moveSelection(delta);
  };

  const handleBackgroundClick = (event: MouseEvent) => {
    if (suppressClick) { suppressClick = false; return; }
    if (!(event.target instanceof Element && event.target.closest('[data-library-key]'))) {
      selectKeys([]);
    }
  };

  const hasAssets = () => allAssets().length > 0;
  const hasContent = () => hasAssets() || allPartials().length > 0 || allFolders().length > 0;
  const isFiltering = () => query().trim().length > 0 || assetFilter() !== "ALL";
  const isEmptyView = () => visibleFolders().length === 0 && filteredPartials().length === 0 && filteredAssets().length === 0;

  const handleCreateFolder = () => withLibrary((lib) => {
    const parent = currentFolder();
    const name = lib.uniqueFolderName(parent, "New folder");
    const folder = lib.createFolder(parent ? `${parent}/${name}` : name);
    setRenamingFolder(folder);
  });

  /**
   * The panel's own keys, the ones its menu advertises. These commands are the
   * library's rather than the stage's, so they are bound here and not in the
   * engine's shortcut table, and they act on the folder the panel is showing —
   * the same folder the buttons import into.
   */
  const handleShortcut = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || isInputTarget(event)) return;
    const key = event.key.toLowerCase();

    if (key === "i" && !event.shiftKey) {
      event.preventDefault();
      void handleImportAssets();
      return;
    }

    if (key === "n" && event.shiftKey) {
      event.preventDefault();
      handleCreateFolder();
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleShortcut);
    onCleanup(() => window.removeEventListener("keydown", handleShortcut));
  });

  return (
    <div
      on:drop={handleDrop}
      on:dragover={handleDragOver}
      on:dragenter={handleDragEnter}
      on:dragleave={handleDragLeave}
      class="relative flex flex-col flex-1 min-h-0 text-foreground text-sm focus:outline-none"
      tabIndex={0}
      ref={root}
      onKeyDown={handleKeyDown}
    >
      <div class="h-11 shrink-0 flex items-center gap-2 px-4 border-y border-border [[data-platform=win32]_&]:border-t-0">
        <div class="flex-1 min-w-0 flex items-center">
          <SidebarTabs />
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <Show when={hasAssets()}>
            <DropdownMenu placement="bottom-start">
              <Tooltip>
                <TooltipTrigger<typeof DropdownMenuTrigger>
                  as={(triggerProps: object) => (
                    <DropdownMenuTrigger<typeof Button>
                      {...triggerProps}
                      as={(buttonProps) => (
                        <Button
                          {...buttonProps}
                          size="icon"
                          variant="ghost"
                          class="text-muted-foreground data-expanded:bg-accent data-expanded:text-foreground"
                        >
                          <Icon name="preferences-adjust" class="size-6" />
                        </Button>
                      )}
                    />
                  )}
                />
                <TooltipContent>Filter assets</TooltipContent>
              </Tooltip>
              <DropdownMenuPortal>
                <DropdownMenuContent class="w-32">
                  <For each={ASSET_FILTER_OPTIONS}>
                    {(option) => (
                      <DropdownMenuItem
                        tone="neutral"
                        class="gap-1 px-0 pr-2"
                        onSelect={() => setAssetFilter(option.value)}
                      >
                        <FilterIconStack
                          icon={option.icon}
                          selected={assetFilter() === option.value}
                        />
                        <span class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                          {option.label}
                        </span>
                      </DropdownMenuItem>
                    )}
                  </For>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>
          </Show>
          <DropdownMenu placement="bottom-start">
            <Tooltip>
              <TooltipTrigger<typeof DropdownMenuTrigger>
                as={(triggerProps: object) => (
                  <DropdownMenuTrigger<typeof Button>
                    {...triggerProps}
                    as={(buttonProps) => (
                      <Button
                        {...buttonProps}
                        size="icon"
                        variant="ghost"
                        aria-label="Add assets"
                        class="text-muted-foreground data-expanded:bg-accent data-expanded:text-foreground"
                      >
                        <Icon name="plus-add" class="size-6" />
                      </Button>
                    )}
                  />
                )}
              />
              <TooltipContent shortcut="⌘I">Import assets</TooltipContent>
            </Tooltip>
            <DropdownMenuPortal>
              <DropdownMenuContent class="w-40">
                <DropdownMenuItem tone="neutral" onSelect={handleImportAssets}>
                  Import assets
                  <DropdownMenuShortcut>⌘I</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem tone="neutral" onSelect={handleImportFolder}>
                  Importar carpeta
                </DropdownMenuItem>
                <DropdownMenuItem tone="neutral" onSelect={handleCreateFolder}>
                  Create folder
                  <DropdownMenuShortcut>⇧⌘N</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        </div>
      </div>

      <Show when={hasContent() && !isDragging()}>
        <div class="shrink-0 px-4 pt-4 pb-1 flex flex-col gap-4">
          <Show when={currentFolder() !== ""}>
            <Breadcrumbs separator="/">
              <BreadcrumbList class="text-xs gap-1 sm:gap-1">
                <BreadcrumbCrumb label="All assets" folder="" onOpen={openFolder} />
                <Show when={collapsedFolders().length > 0}>
                  <BreadcrumbsSeparator />
                  <BreadcrumbsItem>
                    <DropdownMenu placement="bottom-start">
                      <DropdownMenuTrigger class="flex items-center gap-1 rounded outline-none focus-ring hover:text-foreground">
                        <BreadcrumbsEllipsis class="size-4" />
                        <span class="sr-only">Show parent folders</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuContent class="w-40">
                          <For each={collapsedFolders()}>
                            {(folder) => (
                              <DropdownMenuItem
                                tone="neutral"
                                onSelect={() => openFolder(folder)}
                              >
                                <span class="truncate">{basename(folder)}</span>
                              </DropdownMenuItem>
                            )}
                          </For>
                        </DropdownMenuContent>
                      </DropdownMenuPortal>
                    </DropdownMenu>
                  </BreadcrumbsItem>
                </Show>
                <For each={tailFolders()}>
                  {(folder) => (
                    <>
                      <BreadcrumbsSeparator />
                      <BreadcrumbCrumb
                        label={basename(folder)}
                        folder={folder}
                        current={folder === currentFolder()}
                        onOpen={openFolder}
                      />
                    </>
                  )}
                </For>
              </BreadcrumbList>
            </Breadcrumbs>
          </Show>
          <div class="relative">
            <div class="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <Icon name="search" class="size-6" />
            </div>
            <input
              type="text"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder={t(itemCount() === 1 ? 'Buscar en {count} recurso' : 'Buscar en {count} recursos').replace('{count}', () => String(itemCount()))}
              class="w-full h-7 rounded-md bg-input pl-8 pr-0 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-ring"
            />
          </div>
          <Show when={activeFilterLabel()} keyed>
            {(label) => (
              <div class="flex flex-wrap gap-2">
                <FilterBadge
                  label={label}
                  onRemove={() => setAssetFilter("ALL")}
                />
              </div>
            )}
          </Show>
        </div>
      </Show>

      <div class="relative flex-1 min-h-0 flex flex-col">
        <Show when={isDragging()}>
          <div class="absolute inset-x-2 bottom-2 top-0 z-50 p-2 bg-background rounded-xl border border-ring">
            <div class="absolute inset-0 bg-accent/20 rounded-xl" />
            <div class="size-full flex items-center justify-center rounded-md border border-dashed border-border-input">
              <Icon name="plus-add" class="size-6 text-muted-foreground" />
              <span class="text-xxs font-450 text-muted-foreground">Drop media here</span>
            </div>
          </div>
        </Show>
        <div
          ref={scroller}
          class="relative flex-1 min-h-0 overflow-y-auto p-4 pt-3 select-none"
          role="listbox"
          aria-label="Recursos del proyecto"
          aria-multiselectable="true"
          onClick={handleBackgroundClick}
          onPointerDown={handleSelectionDown}
          onPointerMove={handleSelectionMove}
          onPointerUp={handleSelectionUp}
          onPointerCancel={handleSelectionUp}
        >
          <Show when={selectedKeys().length > 1}>
            <div class="absolute inset-x-3 bottom-2 z-20 flex h-7 items-center justify-between gap-2 rounded bg-popover px-2 text-xxs text-muted-foreground shadow-sm" aria-live="polite">
              <span>{selectedKeys().length} seleccionados</span>
              <button class="rounded px-1.5 py-1 hover:bg-accent focus-ring" onClick={() => void deleteSelected()}>Quitar recursos</button>
            </div>
          </Show>
          <Show when={isEmptyView() && !isFiltering()}>
            <div class="h-full flex flex-col items-center justify-center gap-4 px-6 pb-[88px] pt-4">
              <div class="flex flex-col items-center gap-1">
                <Icon name="navigation.folder" class="size-8 text-muted-foreground" />
                <span class="text-xs font-450 text-muted-foreground">
                  Add media
                </span>
                <p class="text-xxs text-muted-foreground text-center">
                  Drag here or import from your computer.
                </p>
              </div>
              <div class="flex flex-col gap-2 w-full">
                <Button variant="default" class="w-full" onClick={handleImportAssets}>
                  Import media
                </Button>
              </div>
            </div>
          </Show>
          <Show when={isEmptyView() && isFiltering()}>
            <div class="h-full flex items-center justify-center text-xs text-muted-foreground">
              No matching assets
            </div>
          </Show>
          <Show when={!isEmptyView()}>
            <div class="grid grid-cols-2 gap-x-2 gap-y-4">
              <For each={visibleFolders()}>
                {(folder) => (
                  <FolderItem
                    path={folder}
                    renaming={renamingFolder() === folder}
                    onRenameStart={() => setRenamingFolder(folder)}
                    onRenameEnd={() => setRenamingFolder(null)}
                    onOpen={() => openFolder(folder)}
                    selected={selectedKeys().includes(`folder:${folder}`)}
                    onSelect={event => handleSelectAsset(`folder:${folder}`, event)}
                    onDelete={deleteSelected}
                  />
                )}
              </For>
              <For each={filteredPartials()}>
                {(partial) => (
                  <PartialAssetItem
                    partial={partial}
                    selected={selectedKeys().includes(partial.id)}
                    onSelect={event => handleSelectAsset(partial.id, event)}
                    onDelete={deleteSelected}
                  />
                )}
              </For>
              <For each={filteredAssets()}>
                {(asset) => (
                  <LazyAssetItem
                    asset={asset}
                    selected={selectedKeys().includes(asset.id)}
                    onSelect={event => handleSelectAsset(asset.id, event)}
                    onDelete={deleteSelected}
                    selectedIds={selectedIds()}
                  />
                )}
              </For>
            </div>
          </Show>
          <Show when={selectionBox()} keyed>
            {box => <div aria-hidden="true" class="pointer-events-none absolute z-30 border border-primary bg-primary/15"
              style={{ left: `${box.left}px`, top: `${box.top}px`, width: `${box.right - box.left}px`, height: `${box.bottom - box.top}px` }} />}
          </Show>
        </div>
      </div>
    </div>
  );
}

type AssetFilter = "ALL" | "VIDEO" | "IMAGE" | "AUDIO";

const ASSET_FILTER_OPTIONS: ReadonlyArray<{
  value: AssetFilter;
  label: string;
  icon: string;
}> = [
    { value: "ALL", label: "All", icon: "all-media-types" },
    { value: "VIDEO", label: "Video", icon: "video" },
    { value: "IMAGE", label: "Image", icon: "media-image" },
    { value: "AUDIO", label: "Audio", icon: "media-audio" },
  ];

type FilterIconStackProps = {
  icon: string;
  selected: boolean;
};

function FilterIconStack(props: FilterIconStackProps) {
  return (
    <div class="flex items-center">
      <span class="w-6 h-7 shrink-0 flex items-center justify-center">
        <Show when={props.selected}>
          <Icon name="confirm-check" class="size-6 text-popover-foreground" />
        </Show>
      </span>
      <span class="w-7 h-7 flex items-center justify-center">
        <Icon name={props.icon} class="size-6 text-popover-foreground" />
      </span>
    </div>
  );
}

type BreadcrumbCrumbProps = {
  label: string;
  folder: string;
  current?: boolean;
  onOpen(folder: string): void;
};

/**
 * One segment of the folder path. Clicking navigates there; assets and
 * folders can be dropped on it to move them to that level.
 */
function BreadcrumbCrumb(props: BreadcrumbCrumbProps) {
  const [isDropTarget, setIsDropTarget] = createSignal(false);
  const library = useLibrary();

  const handleDragOver = (event: DragEvent) => {
    if (!isAssetOrFolderDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDropTarget(true);
  };

  const handleDrop = (event: DragEvent) => {
    if (!isAssetOrFolderDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDropTarget(false);
    handleFolderDrop(library(), event, props.folder);
  };

  return (
    <BreadcrumbsItem>
      <BreadcrumbsLink
        as="button"
        current={props.current}
        data-drop-target={isDropTarget()}
        class="max-w-32 truncate rounded px-1 outline-none focus-ring data-[current]:text-muted-foreground hover:text-foreground data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-inset data-[drop-target=true]:ring-ring"
        onClick={() => props.onOpen(props.folder)}
        on:dragover={handleDragOver}
        on:dragleave={() => setIsDropTarget(false)}
        on:drop={handleDrop}
      >
        {props.label}
      </BreadcrumbsLink>
    </BreadcrumbsItem>
  );
}

type FilterBadgeProps = {
  label: string;
  onRemove: () => void;
};

function FilterBadge(props: FilterBadgeProps) {
  return (
    <button
      class="h-5 rounded bg-input pl-1 pr-0 inline-flex items-center gap-1 text-xxs text-foreground outline-none focus-ring"
      onClick={props.onRemove}
    >
      <span>{props.label}</span>
      <span class="relative w-4 h-5 flex items-center justify-center overflow-hidden">
        <Icon name="close-remove-small" class="absolute -left-1 -top-0.5 size-6" />
      </span>
    </button>
  );
}
