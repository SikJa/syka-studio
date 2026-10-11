/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { mimeTypeToExtension } from "./media";
import { colord } from "colord";
import { ElectronFileHandle } from "@/lib/electron-file-handle";

/**
 * Reads the computed value of a CSS custom property from the document root.
 * @param name - The CSS variable name (e.g., `'--color-canvas'`)
 * @returns The resolved value as a colord instance
 */
export function getCssVar(name: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  return colord(value);
}

/**
 * Opens the browser's EyeDropper to pick a color from the screen.
 * @returns The selected hex color string, or null if cancelled/unsupported
 */
export async function pickScreenColor(): Promise<string | null> {
  try {
    const eyeDropper = new (window as any).EyeDropper();
    const result = await eyeDropper.open();
    return result.sRGBHex;
  } catch {
    // User cancelled or error occurred
    return null;
  }
}

/**
 * Verifies if we still have permission to access the handle.
 * Returns true if permission is granted, false otherwise.
 */
export async function verifyHandlePermission(
  handle: FileSystemDirectoryHandle | FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  const options = { mode };

  // Check if we already have permission
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }

  // Request permission if not granted
  if ((await handle.requestPermission(options)) === 'granted') {
    return true;
  }

  return false;
}

/**
 * Batch-verifies permission for many handles. Calls requestPermission on every
 * handle that needs it in parallel within the same task — Chromium consolidates
 * the prompts into a single dialog listing all files. Must be invoked during a
 * transient user activation (e.g. inside a click handler).
 */
export async function verifyHandlePermissions(
  handles: (FileSystemDirectoryHandle | FileSystemFileHandle | ElectronFileHandle)[],
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  if (handles.length === 0) return true;

  const options = { mode };
  const states = await Promise.all(handles.map(h => h.queryPermission(options)));
  const pending = handles.filter((_, i) => states[i] !== 'granted');
  if (pending.length === 0) return true;

  const results = await Promise.all(pending.map(h => h.requestPermission(options)));
  return results.every(state => state === 'granted');
}

/**
 * This utility creates a file input element and clicks on it
 * @param accept comma separated mime types
 * @example audio/mp3, video/mp4
 * @param multiple enable multiselection
 * @default true
 */
export async function showFileDialog(
  accept = 'image/*,video/*,audio/*,text/*',
  multiple = true
): Promise<(File | FileSystemFileHandle | ElectronFileHandle)[]> {
  try {
    if (!window.desktop && 'showOpenFilePicker' in window) {
      return await window.showOpenFilePicker({
        multiple,
        startIn: 'downloads',
      });
    }

    return new Promise<(File | ElectronFileHandle)[]>(resolve => {
      // setup input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = multiple;
      // listen for changes
      input.onchange = (fileEvent: Event) => {
        const files = Array.from((fileEvent.target as HTMLInputElement)?.files ?? []);
        resolve(files.map((file) => {
          const path = window.desktop?.getPathForFile(file);
          return path ? ElectronFileHandle.fromFile(path, file) : file;
        }));
      };
      input.oncancel = () => resolve([]);
      input.click();
    });
  } catch {
    return [];
  }
}

/**
 * This utility creates an anchor tag and clicks on it
 * @param source Blob url or base64 encoded svg
 * @param name File name suggestion
 */
export async function downloadObject(source: Blob, name?: string): Promise<void> {
  const a = document.createElement('a');
  document.head.appendChild(a);
  a.target = '_blank';

  // Add extension to name if it doesn't have one
  if (name && !name.match(/\.[^.]+$/)) {
    if (source instanceof File) {
      name = name + mimeTypeToExtension(source.type);
    } else if (source instanceof FileSystemFileHandle) {
      const file = await source.getFile();
      name = name + mimeTypeToExtension(file.type);
    }
  }

  if (name) {
    a.download = name;
  } else if (source instanceof File) {
    a.download = source.name;
  } else if (source instanceof Blob) {
    a.download = 'untitled';
  }

  a.href = URL.createObjectURL(source);

  a.click();
  a.remove();
}

export function isInputTarget(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}
