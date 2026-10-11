/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { onMount, type JSX } from "solid-js";
import { insert } from "solid-js/web";

type AdoptNodeProps = {
  node: Node;
  class?: string;
  children?: JSX.Element;
};

export function AdoptNode(props: AdoptNodeProps) {
  let anchor!: HTMLDivElement;

  onMount(() => {
    insert(anchor, props.node);
  });

  return <div ref={anchor} class={props.class}>{props.children}</div>;
}
