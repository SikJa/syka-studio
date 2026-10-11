/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { useNavigate } from "@solidjs/router";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { isServer } from "solid-js/web";
import { toast } from "somoto";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Composer } from "@/agent-chat/mirel-composer";
import { activeChatId, blockedReason, draft, draftKey, setDraftAttachments, setDraftText, setSidebarTab } from "@/agent-chat/store";
import {
  attachmentPaths,
  currentModel,
  setStoredModel,
  startChat,
  type Attachment,
} from "@/agent-chat";
import { projectRoute, useReturnHere } from "@/hooks/use-project-route";
import { track } from "@/lib/analytics";
import { generateProjectName } from "@/lib/db";
import {
  createProject,
  ensureProjectsRoot,
  isDesktop,
  listProjects,
  openProjectFolder,
  pickProjectFolder,
  projectKey,
  projectsRevision,
  type ProjectInfo,
} from "@/projects";

import { DeleteProjectDialog } from "./delete-project-dialog";
import { DashboardProjectCard } from "./project-card";
import {
  DashboardCardButton,
  DashboardCardMeta,
  DashboardCardPreview,
  createBackgroundClickHandler,
  createNewProject,
  openProjectFromList,
} from "./shared";
import { parseTimestamp } from "./utils";
import { useAuth } from '@/context/auth';
import { SykaChatOrb } from '@/agent-chat/mirel-messages';
import { motionPreference } from '@/components/settings/state';
import { homeGreeting } from './home-greeting';
import { t } from '@/i18n';
import './home-greeting.css';
import { VideoLinkImport } from './video-link-import';
import { attachmentFromPath, mergeAttachments } from '@/agent-chat/attachments';
import type { VideoImportResult } from '@desktop/video-import/types';

/**
 * Where the prompt lands: a project chosen from the recents, a folder chosen
 * from the picker — any folder will do, `resolveTarget` makes it a Diffusion
 * Studio project — or, until either is chosen, a fresh project under the
 * application folder.
 */
type PromptTarget =
  | { kind: "new" }
  | { kind: "project"; project: ProjectInfo }
  | { kind: "folder"; dir: string };

/** Cards that fit the one row the design gives recents, the new one included. */
const RECENT_COLUMNS = 5;

/** Recent projects the target menu offers before it gets unwieldy. */
const MENU_PROJECTS = 8;


/** The edits the placeholder cycles through, one whole line at a time. */
const PROMPT_EXAMPLES = [
  "Convertí este material en un video para YouTube, con subtítulos claros y una apertura que atrape.",
  "Sacá el mejor momento de este video y armá un reel de 30 segundos para redes.",
  "Usá mis referencias y mi marca para crear tarjetas animadas con un estilo consistente.",
];

/** Milliseconds a line takes to fade in or out, and how long it stays readable. */
const FADE_MS = 500;
const HOLD_MS = 2400;

export function DashboardHomeView() {
  const auth = useAuth();
  const [now, setNow] = createSignal(new Date());
  const [systemReduced, setSystemReduced] = createSignal(false);
  onMount(() => {
    const reducedMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setSystemReduced(reducedMedia.matches);
    updateMotion();reducedMedia.addEventListener('change', updateMotion);
    const clockTimer = setInterval(() => setNow(new Date()), 60_000);
    onCleanup(() => {clearInterval(clockTimer);reducedMedia.removeEventListener('change',updateMotion);});
  });
  const navigate = useNavigate();
  const returnHere = useReturnHere();

  const [prompt, setPrompt] = createSignal("");
  const [target, setTarget] = createSignal<PromptTarget>({ kind: "new" });
  const [selectedProject, setSelectedProject] = createSignal<string | null>(
    null,
  );
  const [busy, setBusy] = createSignal(false);
  const [attachments, setAttachments] = createSignal<Attachment[]>([]);
  const [videoImportPending, setVideoImportPending] = createSignal(false);
  const [importedVideos, setImportedVideos] = createSignal<VideoImportResult[]>([]);

  // Only worth animating while the field is empty — the placeholder is not on
  // screen behind text the user has typed.
  const placeholder = createFadingPlaceholder(() => prompt().length === 0);

  // The projects the app knows — created here, or opened from a folder —
  // refetched whenever that list changes.
  const [projects, { refetch: refetchProjects }] = createResource(
    projectsRevision,
    () => listProjects(),
  );
  // The model is shared with the chat panel and remembered across sessions;
  // the picker is fed by the agent host's probes, so what it offers is what
  // is installed and signed in.
  const model = createMemo(() => currentModel());

  const recentProjects = createMemo(() =>
    [...(projects() ?? [])].sort(
      (a, b) => parseTimestamp(b.modifiedAt) - parseTimestamp(a.modifiedAt),
    ),
  );

  const targetLabel = () => {
    const current = target();
    if (current.kind === "project") return current.project.displayName;
    if (current.kind === "folder") return folderName(current.dir);
    return t("Elegir proyecto");
  };

  const canSubmit = () => prompt().trim().length > 0 && !busy() && model() !== null;

  const promptWithImportedVideos = () => {
    const paths = attachmentPaths(attachments());
    const imported = importedVideos().filter(video => paths.includes(video.path));
    return prompt() + (imported.length ? '\n\nMaterial ya importado (no volver a descargar ni transcribir completo sin pedirlo):\n' + imported.map(video => `Archivo local: ${video.path}\nRuta relativa en su proyecto de origen: ${video.relativePath}\nOrigen: ${video.sourceUrl}\nIntervalo original: ${video.sourceRange.start}–${video.sourceRange.end} s. El archivo local empieza en 0 y dura ${video.duration} s. Los tiempos locales se mapean sumando ${video.sourceRange.start} s.\nFicha: ${video.provenancePath}`).join('\n') : '');
  };

  const handlePickFolder = async () => {
    try {
      const dir = await pickProjectFolder();
      if (dir) setTarget({ kind: "folder", dir });
    } catch (e) {
      toast.error("No se pudo elegir la carpeta", {
        description: (e as Error).message,
      });
    }
  };

  /**
   * The folder the agent will work in. A picked folder is opened as a project,
   * which scaffolds an entry into it when it is not one already — so any
   * folder on disk can be the answer, not only a project we made. With none
   * picked, a fresh project under the application folder.
   */
  const resolveTarget = async (): Promise<ProjectInfo | null> => {
    const current = target();
    // A project off the list is its record; the folder is looked at now.
    if (current.kind === "project") return openProjectFromList(current.project);
    if (current.kind === "folder") return openProjectFolder(current.dir);

    // Waits for the roots to come back from the database, and asks for one
    // when there is none to wait for.
    if (!(await ensureProjectsRoot())) return null;
    return createProject(generateProjectName());
  };

  const handleSubmit = async () => {
    if (videoImportPending()) { toast.info('Primero importá el video o quitá el enlace del mensaje.'); return; }
    if (!canSubmit()) return;

    if (!isDesktop()) {
      toast.error("Los proyectos locales funcionan en la aplicación de escritorio");
      return;
    }

    const paths = attachmentPaths(attachments());
    const ref = model();
    if (!ref) return;
    const text = promptWithImportedVideos();
    setBusy(true);

    try {
      const project = await resolveTarget();
      if (!project) return;

      track("home_prompt_sent", {
        agent: `${ref.harness}/${ref.model}`,
        target: target().kind,
        attachments: paths.length,
      });
      // The chat starts before the page switches: the host has the turn as
      // soon as it answers, and the editor lands with the reply streaming.
      // On failure the text survives as the project's draft (see startChat).
      await startChat({ project, text, attachments: paths, model: ref });
      setPrompt("");
      setAttachments([]);
      setImportedVideos([]);
      setTarget({ kind: "new" });
      refetchProjects();
      navigate(projectRoute(projectKey(project)), { state: returnHere() });
    } catch (e) {
      toast.error("No se pudo abrir el proyecto", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  // Anything outside a card clears the selection — the grid's gaps, the space
  // around it, and the composer above it. A click on a card is that card's.
  const clearSelection = createBackgroundClickHandler(() =>
    setSelectedProject(null),
  );

  const [pendingDelete, setPendingDelete] = createSignal<ProjectInfo | null>(null);

  const handleDeleted = (project: ProjectInfo) => {
    setSelectedProject((current) => (current === project.dir ? null : current));
    refetchProjects();
  };

  const openProject = async (project: ProjectInfo) => {
    const found = await openProjectFromList(project);
    if (!found) return;
    track("project_opened");
    navigate(projectRoute(projectKey(found)), { state: returnHere() });
  };

  const handleCreateProject = async () => {
    if (busy()) return;
    setBusy(true);

    try {
      const project = await createNewProject();
      if (!project) return;
      setSelectedProject(null);
      refetchProjects();
      openProject(project);
    } catch (e) {
      toast.error("No se pudo crear el proyecto", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        class="flex min-h-0 flex-1 flex-col overflow-y-auto"
        onClick={clearSelection}
      >
        <div class="flex flex-1 flex-col items-center justify-center gap-6.5 px-6 py-8 pt-[15%]">
          <div class="syka-home-intro">
            <div class="syka-home-orb"><SykaChatOrb working={false} variant="hero" paused={systemReduced() || motionPreference()==='reduced'}/></div>
            <h1 class="syka-home-heading w-full text-center font-450 tracking-[0.0864px] text-foreground">{homeGreeting(auth.localProfile().displayName,now())}</h1>
          </div>

          <div class="flex flex-col items-center">
            <div class="flex w-139 flex-col items-start rounded-t-xl border border-b-0 border-border bg-accent/50 px-1 pt-1 pb-0.5">
              <DropdownMenu placement="bottom-start">
                <DropdownMenuTrigger
                  as="button"
                  type="button"
                  aria-label="Elegir la carpeta del proyecto"
                  class="flex h-7 shrink-0 items-center rounded-md pl-0.5 pr-2 text-xs font-450 text-muted-foreground hover:bg-accent focus-ring"
                >
                  <span class="grid size-6 shrink-0 place-items-center overflow-clip">
                    <Icon name="navigation.folder" />
                  </span>
                  <span class="max-w-60 truncate">{targetLabel()}</span>
                  <span class="grid h-7 w-5 shrink-0 place-items-center overflow-clip">
                    <Icon name="chevron-down" />
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent class="w-60">
                    {/* One action, not a new/open pair: the picker takes any
                        folder, and a folder that is not a project yet becomes
                        one when the prompt is sent. */}
                    <DropdownMenuGroup>
                      <DropdownMenuItem onSelect={handlePickFolder}>
                        <Icon name="plus-add" />
                        <span class="min-w-0 flex-1 truncate">
                          Crear proyecto…
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <Show when={recentProjects().length > 0}>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuGroupLabel>
                          Proyectos recientes
                        </DropdownMenuGroupLabel>
                        <For each={recentProjects().slice(0, MENU_PROJECTS)}>
                          {(project) => (
                            <DropdownMenuItem
                              onSelect={() =>
                                setTarget({ kind: "project", project })
                              }
                            >
                              <Icon name="navigation.folder" />
                              <span class="min-w-0 flex-1 truncate">
                                {project.displayName}
                              </span>
                            </DropdownMenuItem>
                          )}
                        </For>
                      </DropdownMenuGroup>
                    </Show>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>
            </div>

            <div class="syka-home-composer">
              <VideoLinkImport text={prompt()} attachedPaths={attachmentPaths(attachments())} onPending={setVideoImportPending}
                resolveProject={async () => { const project = await resolveTarget(); if (!project) return null; setTarget({kind:'project',project}); return {dir:project.dir,seedTimeline:true}; }}
                onImported={(video, metadata) => { setImportedVideos(list => [...list.filter(v => v.path !== video.path),video]); setAttachments(list => mergeAttachments(list,[{...attachmentFromPath(video.path),name:metadata.title+'.mp4',mimeType:'video/mp4'}])); void openProjectFolder(video.projectDir).then(project => setTarget({kind:'project',project})).catch(e => toast.error('No se pudo abrir el proyecto',{description:String(e)})); refetchProjects(); }}
                onOpen={async video => { const project = await openProjectFolder(video.projectDir); const key = draftKey(project.id,activeChatId(project.id)), previous = draft(key); const incoming = promptWithImportedVideos(); setDraftText(key,previous.text && previous.text !== incoming ? previous.text+'\n\n'+incoming : incoming); setDraftAttachments(key,mergeAttachments(previous.attachments,attachments())); setSidebarTab('chat'); navigate(projectRoute(projectKey(project)), {state:returnHere()}); }}/>
              <Composer projectDir={target().kind === 'project' ? (target() as { kind:'project'; project:ProjectInfo }).project.dir : ''}
                resolveProjectDir={async () => { const project = await resolveTarget(); if (!project) return null; setTarget({kind:'project',project}); return project.dir; }}
                chatKey="home" text={prompt()} onText={setPrompt} attachments={attachments()} onAttachments={setAttachments}
                running={false} waiting={busy()} blocked={blockedReason()} model={model()} onModel={setStoredModel}
                placeholder={placeholder.line()} onSend={() => void handleSubmit()} onStop={() => {}} />
            </div>
          </div>
        </div>

        <div class="flex shrink-0 flex-col">
          <div class="flex items-end gap-6 px-6 pt-4 pb-3">
            <h2 class="min-w-0 flex-1 text-2xl leading-6 font-450 text-foreground">
              Proyectos recientes
            </h2>
          </div>
          <div
            data-slot="card-grid"
            class="grid grid-cols-5 items-start gap-x-0.5 gap-y-3 px-4 pb-4"
          >
            <DashboardCardButton onClick={handleCreateProject}>
              <DashboardCardPreview class="syka-new-project-preview">
                <Icon
                  name="plus-add"
                  class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </DashboardCardPreview>
              <DashboardCardMeta title="Nuevo proyecto" />
            </DashboardCardButton>
            <For each={recentProjects().slice(0, RECENT_COLUMNS - 1)}>
              {(project) => (
                <DashboardProjectCard
                  project={project}
                  active={selectedProject() === project.dir}
                  onSelect={() => setSelectedProject(project.dir)}
                  onDeselect={() => setSelectedProject(null)}
                  onOpen={() => openProject(project)}
                  onDelete={() => setPendingDelete(project)}
                  onChanged={refetchProjects}
                />
              )}
            </For>
          </div>
        </div>
      </div>

      <DeleteProjectDialog
        project={pendingDelete()}
        onClose={() => setPendingDelete(null)}
        onDeleted={handleDeleted}
      />
    </>
  );
}

/**
 * The composer's placeholder, cycling through {@link PROMPT_EXAMPLES}: each
 * prompt fades in whole, however many lines it wraps to, holds long enough
 * to be read, fades out, and the next one follows. It pauses whenever `active` goes false, and for anyone who asked
 * the system for less motion it settles on the first line and stays there.
 */
function createFadingPlaceholder(active: () => boolean) {
  const [index, setIndex] = createSignal(0);
  const line = () => t(PROMPT_EXAMPLES[index()]);

  if (
    isServer ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return { line, visible: () => true };
  }

  const [visible, setVisible] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const step = () => {
    if (visible()) {
      setVisible(false);
      timer = setTimeout(step, FADE_MS);
    } else {
      setIndex((current) => (current + 1) % PROMPT_EXAMPLES.length);
      setVisible(true);
      timer = setTimeout(step, FADE_MS + HOLD_MS);
    }
  };

  createEffect(() => {
    clearTimeout(timer);
    setVisible(false);
    if (!active()) return;

    // The span mounts at opacity 0 first, so its first line fades in like
    // the rest instead of appearing in one go.
    timer = setTimeout(() => {
      setVisible(true);
      timer = setTimeout(step, FADE_MS + HOLD_MS);
    }, 50);
  });
  onCleanup(() => clearTimeout(timer));

  return { line, visible };
}

/** The last segment of a path, for naming a folder the user picked. */
function folderName(dir: string): string {
  return (
    dir
      .replace(/[/\\]+$/, "")
      .split(/[/\\]/)
      .pop() || dir
  );
}
