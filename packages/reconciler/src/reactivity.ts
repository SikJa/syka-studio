/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Mount-local diagnostic metadata. A host's current numeric opacity is not
// evidence that a getter (for example useTicker().time()) stays at that value.
// Keep this off authored props, serialization and the render path. Nodes are
// garbage-collected with their mount, including capture/export mounts.
const reactiveOpacityNodes = new WeakSet<object>();

export function markReactiveOpacity(node: unknown, props: object): void {
  if (typeof node !== 'object' || node === null) return;
  if (typeof Object.getOwnPropertyDescriptor(props, 'opacity')?.get === 'function') {
    reactiveOpacityNodes.add(node);
  }
}

export function hasReactiveOpacity(node: unknown): boolean {
  return typeof node === 'object' && node !== null && reactiveOpacityNodes.has(node);
}
