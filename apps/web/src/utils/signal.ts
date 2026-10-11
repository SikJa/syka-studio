/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createMemo, createRoot, createSignal, type Accessor } from "solid-js";

export type SignalFunction<T> = {
  (): T;
  <S extends T>(value: S): S;
}

export function onCreated(fn: () => void): void {
  fn();
}

export function createSignalFunction<T>(initialValue: T): SignalFunction<T> {
  const [currentValue, setCurrentValue] = createSignal<T>(initialValue);

  function fn(): T;
  function fn(value: T): T;
  function fn(value?: T): T {
    if (arguments.length > 0 && value !== undefined) {
      setCurrentValue(() => value);
    }

    return currentValue();
  }

  return fn;
}

export function createRootMemo<T>(fn: () => T): [Accessor<T>, () => void] {
  return createRoot(dispose => {
    const memo = createMemo(() => fn());

    return [memo, dispose];
  });
}

export function createRootEffect(fn: () => void): () => void {
  return createRoot(dispose => {
    fn();
    return dispose;
  });
}

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type MergeTwo<A, B> = Simplify<Omit<A, keyof B> & B>;

// Merge in order: MergeMany<[A, B, C]> = MergeTwo<MergeTwo<A, B>, C>
type MergeMany<T extends readonly unknown[]> =
  T extends readonly [infer A, infer B, ...infer R]
  ? MergeMany<readonly [MergeTwo<A & object, B & object>, ...R]>
  : T extends readonly [infer Only]
  ? Only & object
  : {};

type Nullable<T> = T | null | undefined;

/**
 * Object.assign semantics for *enumerable own props* (string + symbol),
 * but preserves property descriptors (getters/setters/etc).
 *
 * Return type matches ordered object spread:
 *   { ...target, ...sources }
 */
export function mergeProps<
  T extends object,
  const S extends readonly object[]
>(
  target: T,
  ...sources: { [K in keyof S]: Nullable<S[K]> }
): Simplify<MergeMany<readonly [T, ...S]>> {
  for (const source of sources) {
    if (source == null) continue;

    const descriptors: PropertyDescriptorMap = {};

    // enumerable string keys
    for (const key of Object.keys(source)) {
      const d = Object.getOwnPropertyDescriptor(source, key);
      if (d) descriptors[key] = d;
    }

    // enumerable symbol keys
    for (const sym of Object.getOwnPropertySymbols(source)) {
      const d = Object.getOwnPropertyDescriptor(source, sym);
      if (d?.enumerable) (descriptors as any)[sym] = d;
    }

    Object.defineProperties(target, descriptors);
  }

  return target as any;
}
