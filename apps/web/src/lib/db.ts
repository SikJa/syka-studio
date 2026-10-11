/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { openDB } from 'idb';
import type * as idb from 'idb';

import type { ProjectInfo } from '@desktop/main-channels';

const adjectives = ["Golden", "Silent", "Fast", "Bright", "Dark", "Wild", "Calm"];
const nouns = ["River", "Mountain", "Dream", "Storm", "Sunset", "Forest", "Ocean"];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateProjectName(): string {
  const adj = getRandomElement(adjectives);
  const noun = getRandomElement(nouns);
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleString("en-US", { month: "short" });
  return `${adj} ${noun} ${day} ${month}`;
}

/**
 * A project the app knows: one it created, one it was asked to open — from
 * the folder picker, or `diffusion open <path>` — or one found in the projects
 * root when that was chosen. The dashboard lists these and nothing else.
 * Keyed by folder, which is how main addresses a project.
 */
export interface ProjectRecord extends ProjectInfo {
  recordedAt: string; // When the app first put it on record.
  lastOpenedAt: string;
  cover: Blob | null;
}

/**
 * The bundle a project last mounted successfully, keyed by its id. Two jobs:
 * the copy an export re-renders (see `@/engine/capture`), and the head start
 * the next open of the project mounts while its first compile still runs.
 * Written only after a mount lands, so what is here is always something the
 * canvas has shown.
 */
export interface ProjectBundle {
  projectId: string;
  code: string;
  updatedAt: string;
}

export interface GlobalDBSchema extends idb.DBSchema {
  projects: {
    value: ProjectRecord;
    key: string;
    indexes: {
      'by-id': string;
      'by-last-opened': string;
    };
  };
  bundles: {
    value: ProjectBundle;
    key: string;
  };
}

type UpgradeTransaction = Parameters<NonNullable<idb.OpenDBCallbacks<GlobalDBSchema>['upgrade']>>[3];

const DB_NAME = 'diffusion-studio-idb';
const DB_VERSION = 3;

const dbPromise = openDB<GlobalDBSchema>(DB_NAME, DB_VERSION, {
  async upgrade(db, _oldVersion, _newVersion, tx) {
    if (!db.objectStoreNames.contains('bundles')) {
      db.createObjectStore('bundles', { keyPath: 'projectId' });
    }
    if (!db.objectStoreNames.contains('projects')) {
      const store = db.createObjectStore('projects', { keyPath: 'dir' });
      store.createIndex('by-id', 'id');
      store.createIndex('by-last-opened', 'lastOpenedAt');
    }
    if (db.objectStoreNames.contains('roots' as never)) await retireRoots(db, tx);
  },
});

/** Last segment of a path, whichever separator it uses. */
const folderLabel = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

/**
 * A record for a project the app has not looked at yet: the folder name
 * stands in for the display name, and the record's own dates for the
 * folder's. What a legacy root is upgraded to; the first open replaces it
 * with what the folder actually says.
 */
function placeholderRecord(dir: string, recordedAt: string, lastOpenedAt: string): ProjectRecord {
  const name = folderLabel(dir);
  return { dir, id: '', name, displayName: name, entry: '', modifiedAt: lastOpenedAt, createdAt: recordedAt, recordedAt, lastOpenedAt, cover: null };
}

/**
 * Versions 1 and 2 kept a `roots` store: folders the dashboard scanned for
 * projects (`kind: 'multi'`), and single project folders registered on their
 * own (`kind: 'single'`). Version 3 does away with it. The single ones become
 * project records; the multi ones are dropped — the projects root lives in
 * localStorage now, and the projects the old one held come back on record
 * when the user picks a root again (see `adoptProjectsRoot` in @/projects).
 */
async function retireRoots(db: idb.IDBPDatabase<GlobalDBSchema>, tx: UpgradeTransaction): Promise<void> {
  type LegacyRoot = { path: string; kind?: 'multi' | 'single'; createdAt: string; lastUsedAt: string };
  const projects = tx.objectStore('projects');

  // The store is not in the schema any more, so it is addressed by name.
  const roots = (tx as unknown as idb.IDBPTransaction<unknown, string[], 'versionchange'>).objectStore('roots');
  for (const root of (await roots.getAll()) as LegacyRoot[]) {
    if (root.kind !== 'single') continue;
    await projects.put(placeholderRecord(root.path, root.createdAt, root.lastUsedAt));
  }

  db.deleteObjectStore('roots' as never);
}

// ---------------------------------------------------------------------------
// Project records

/**
 * Puts `project` on record as just opened — what its folder says now,
 * replacing the copy the record held — or on record for the first time.
 */
export async function rememberProject(project: ProjectInfo): Promise<ProjectRecord> {
  const db = await dbPromise;
  const now = new Date().toISOString();
  const existing = await db.get('projects', project.dir);

  const record: ProjectRecord = existing
    ? { ...existing, ...project, lastOpenedAt: now }
    : { ...project, recordedAt: now, lastOpenedAt: now, cover: null };

  await db.put('projects', record);
  return record;
}

/**
 * Brings the record for `project` up to date with what its folder says,
 * without marking it opened — for a project that changed while it was open,
 * and for one that is closing. Nothing to do when it is not on record.
 */
export async function updateProjectRecord(project: ProjectInfo): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction('projects', 'readwrite');
  const existing = await tx.store.get(project.dir);
  if (existing) await tx.store.put({ ...existing, ...project });
  await tx.done;
}

/**
 * Puts every project in `found` that is not on record yet on it, leaving the
 * ones that are alone — they were opened when they were opened. Answers with
 * how many were new. For the projects a freshly chosen root turns out to hold.
 */
export async function addProjectRecords(found: ProjectInfo[]): Promise<number> {
  const db = await dbPromise;
  const now = new Date().toISOString();
  const tx = db.transaction('projects', 'readwrite');
  let added = 0;

  for (const project of found) {
    if (await tx.store.getKey(project.dir)) continue;
    await tx.store.put({ ...project, recordedAt: now, lastOpenedAt: now, cover: null });
    added++;
  }

  await tx.done;
  return added;
}

/** Every project on record, most recently opened first. */
export async function listProjectRecords(): Promise<ProjectRecord[]> {
  const db = await dbPromise;
  return (await db.getAllFromIndex('projects', 'by-last-opened')).reverse();
}

/**
 * The records `ref` could name: those whose id it is, then — for links made
 * before ids existed, and folders opened by name — those whose folder it
 * names. Most recently opened first within each, so a project that was just
 * open wins over a copy of it.
 */
export async function findProjectRecords(ref: string): Promise<ProjectRecord[]> {
  const records = await listProjectRecords();
  return [
    ...records.filter((record) => record.id === ref),
    ...records.filter((record) => record.id !== ref && folderLabel(record.dir) === ref),
  ];
}

/**
 * Re-keys the record for `from` to `to`, for a project whose folder moved
 * (renaming one moves its folder). Nothing to do when `from` is not on record.
 */
export async function moveProjectRecord(from: string, to: string): Promise<void> {
  if (from === to) return;
  const db = await dbPromise;
  const tx = db.transaction('projects', 'readwrite');
  const existing = await tx.store.get(from);
  if (existing) {
    await tx.store.delete(from);
    await tx.store.put({ ...existing, dir: to });
  }
  await tx.done;
}

/**
 * Records `cover` as the picture of the project in `dir`, replacing the one
 * before it. Nothing to do when the project is not on record: one deleted
 * while its cover was still being taken is not put back.
 */
export async function rememberProjectCover(dir: string, cover: Blob): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction('projects', 'readwrite');
  const existing = await tx.store.get(dir);
  if (existing) await tx.store.put({ ...existing, cover });
  await tx.done;
}

/** Takes the project in `dir` off the record. The folder itself is left alone. */
export async function forgetProject(dir: string): Promise<void> {
  const db = await dbPromise;
  await db.delete('projects', dir);
}

// ---------------------------------------------------------------------------
// Project bundles

/** Records the bundle `projectId` just mounted, replacing the one before it. */
export async function rememberProjectBundle(projectId: string, code: string): Promise<void> {
  try {
    const db = await dbPromise;
    await db.put('bundles', { projectId, code, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Failed to remember project bundle', e);
  }
}

/** The bundle `projectId` last mounted, or null when it has none on record. */
export async function loadProjectBundle(projectId: string): Promise<string | null> {
  if (!projectId) return null;
  try {
    const db = await dbPromise;
    return (await db.get('bundles', projectId))?.code ?? null;
  } catch (e) {
    console.error('Failed to load project bundle', e);
    return null;
  }
}

/** Forgets a project's bundle, for when the project itself is deleted. */
export async function forgetProjectBundle(projectId: string): Promise<void> {
  if (!projectId) return;
  try {
    const db = await dbPromise;
    await db.delete('bundles', projectId);
  } catch (e) {
    console.error('Failed to forget project bundle', e);
  }
}
