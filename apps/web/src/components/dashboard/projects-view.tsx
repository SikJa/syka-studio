/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { toast } from "somoto";
import { For, Show, createEffect, createMemo, createResource, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectPortal,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DashboardCardMeta,
  DashboardCardButton,
  DashboardCardPreview,
  DashboardViewSection,
  createNewProject,
  openProjectFromList,
} from "./shared";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { DashboardProjectCard } from "./project-card";
import { parseTimestamp } from "./utils";
import { DashboardSearchPanel } from "./search-bar";
import { DashboardProjectsFolderBar } from "./projects-folder-bar";
import { projectRoute, useReturnHere } from "@/hooks/use-project-route";
import { Icon } from "../ui/icon";
import { Button } from '../ui/button';
import { track } from "@/lib/analytics";
import {
  listProjects,
  projectKey,
  projectsRevision,
  type ProjectInfo,
} from "@/projects";

import type { ProjectSortOption } from "./types";

export function DashboardProjectsView() {
  const navigate = useNavigate();
  const returnHere = useReturnHere();
  const [search, setSearch] = createSignal("");
  const [sort, setSort] = createSignal<ProjectSortOption>("last-viewed");
  const [projects, { refetch: refetchProjects }] = createResource(projectsRevision, () => listProjects());
  const [selectedProject, setSelectedProject] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [pendingDelete, setPendingDelete] = createSignal<ProjectInfo | null>(null);
  const [page, setPage] = createSignal(0);
  createEffect(() => { normalizedSearch(); sort(); setPage(0); });

  const selectedSortOption = () =>
    SORT_OPTIONS.find((option) => option.id === sort()) ?? SORT_OPTIONS[0];

  const normalizedSearch = createMemo(() => search().trim().toLowerCase());

  const filteredProjects = createMemo(() => {
    const query = normalizedSearch();
    const entries = projects() ?? [];
    if (!query) return entries;

    return entries.filter((project) => project.displayName.toLowerCase().includes(query));
  });

  const sortedProjects = createMemo(() => {
    const sortMode = sort();
    const entries = [...filteredProjects()];

    if (sortMode === "alphabetical") {
      entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
      return entries;
    }

    if (sortMode === "date-created") {
      entries.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
      return entries;
    }

    entries.sort((a, b) => parseTimestamp(b.modifiedAt) - parseTimestamp(a.modifiedAt));
    return entries;
  });
  const pageCount = createMemo(() => Math.max(1, Math.ceil(sortedProjects().length / PROJECTS_PER_PAGE)));
  const currentPage = () => Math.min(page(), pageCount() - 1);
  const visibleProjects = () => sortedProjects().slice(currentPage() * PROJECTS_PER_PAGE, (currentPage() + 1) * PROJECTS_PER_PAGE);

  const openProject = async (project: ProjectInfo) => {
    const found = await openProjectFromList(project);
    if (!found) return;
    track('project_opened');
    navigate(projectRoute(projectKey(found)), { state: returnHere() });
  };

  const handleDeleted = (project: ProjectInfo) => {
    setSelectedProject((current) => (current === project.dir ? null : current));
    refetchProjects();
  };

  // New project is the one card a single click still acts on, so a double
  // click lands on it as two clicks — the guard keeps that from creating two
  // projects.
  const handleCreateProject = async () => {
    if (creating()) return;
    setCreating(true);

    try {
      const project = await createNewProject();
      if (!project) return;
      refetchProjects();
      openProject(project);
    } catch (e) {
      toast.error("Failed to create project", { description: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardSearchPanel
      value={search}
      onChange={setSearch}
      placeholder="Buscar en todos los proyectos"
    >
      <DashboardViewSection
        class="pb-4"
        title={`Proyectos (${sortedProjects().length})`}
        onBackgroundClick={() => setSelectedProject(null)}
        controls={
          <>
            <Select<(typeof SORT_OPTIONS)[number]>
              options={SORT_OPTIONS}
              value={selectedSortOption()}
              onChange={(option) => option && setSort(option.id)}
              optionValue="id"
              optionTextValue="label"
              itemComponent={(itemProps) => (
                <SelectItem item={itemProps.item}>
                  {itemProps.item.rawValue.label}
                </SelectItem>
              )}
            >
              <SelectTrigger aria-label="Sort projects">
                <SelectValue<(typeof SORT_OPTIONS)[number]>>
                  {(state) => state.selectedOption()?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectPortal>
                <SelectContent />
              </SelectPortal>
            </Select>
          </>
        }
      >
        <DashboardCardButton onClick={handleCreateProject}>
          <DashboardCardPreview class="bg-overlay-soft group-hover:bg-overlay">
            <Icon
              name="plus-add"
              class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </DashboardCardPreview>
          <DashboardCardMeta title="New project" />
        </DashboardCardButton>
        <For each={visibleProjects()}>
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
      </DashboardViewSection>
      <Show when={pageCount() > 1}><nav aria-label="Páginas de proyectos" class="flex shrink-0 items-center justify-center gap-3 px-4 py-3"><Button variant="ghost" disabled={currentPage() === 0} onClick={() => setPage(currentPage() - 1)}>Anterior</Button><span class="text-xs text-muted-foreground" aria-live="polite">Página {currentPage() + 1} de {pageCount()} · {sortedProjects().length} proyectos</span><Button variant="ghost" disabled={currentPage() + 1 >= pageCount()} onClick={() => setPage(currentPage() + 1)}>Siguiente</Button></nav></Show>
      <DashboardProjectsFolderBar />

      <DeleteProjectDialog
        project={pendingDelete()}
        onClose={() => setPendingDelete(null)}
        onDeleted={handleDeleted}
      />
    </DashboardSearchPanel>
  );
}

const SORT_OPTIONS: Array<{ id: ProjectSortOption; label: string }> = [
  { id: "last-viewed", label: "Last modified" },
  { id: "alphabetical", label: "Alphabetical" },
  { id: "date-created", label: "Date created" },
];

const PROJECTS_PER_PAGE = 11;
