/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */



import type { Item } from "@diffusionstudio/agent-chat";

import "./activity.css";
import {MirelTrace} from "./mirel-messages";

/** What the agent is doing, judged by the item the turn is on. A tool in flight has its own row, so it never lands here. */
export function runningLabel(last: Item | undefined): string {
  return last?.kind === "assistant" ? "Writing" : "Thinking";
}

export function RunningIndicator(props: { last: Item | undefined }) {return <MirelTrace item={{id:'current-thinking',kind:'reasoning',text:props.last?.kind==='assistant'?'Escribiendo la respuesta':'Analizando el proyecto'}}/>;}
