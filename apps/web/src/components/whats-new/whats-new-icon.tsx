/**
 * The `Icon` of Syka Legacy (by name) for Kevin's What's new card, drawn in
 * Solid from lucide's own icon data so the drawings keep their names.
 */
import { For, splitProps, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { __iconNode as ArrowRight } from 'lucide-react/dist/esm/icons/arrow-right.js';
import { __iconNode as ArrowUp } from 'lucide-react/dist/esm/icons/arrow-up.js';
import { __iconNode as AudioLines } from 'lucide-react/dist/esm/icons/audio-lines.js';
import { __iconNode as Bell } from 'lucide-react/dist/esm/icons/bell.js';
import { __iconNode as Captions } from 'lucide-react/dist/esm/icons/captions.js';
import { __iconNode as Check } from 'lucide-react/dist/esm/icons/check.js';
import { __iconNode as Cpu } from 'lucide-react/dist/esm/icons/cpu.js';
import { __iconNode as Gauge } from 'lucide-react/dist/esm/icons/gauge.js';
import { __iconNode as RefreshCw } from 'lucide-react/dist/esm/icons/refresh-cw.js';
import { __iconNode as Settings } from 'lucide-react/dist/esm/icons/settings.js';
import { __iconNode as ChevronDown } from 'lucide-react/dist/esm/icons/chevron-down.js';
import { __iconNode as CircleX } from 'lucide-react/dist/esm/icons/circle-x.js';
import { __iconNode as Clock } from 'lucide-react/dist/esm/icons/clock.js';
import { __iconNode as Download } from 'lucide-react/dist/esm/icons/download.js';
import { __iconNode as Film } from 'lucide-react/dist/esm/icons/film.js';
import { __iconNode as Folder } from 'lucide-react/dist/esm/icons/folder.js';
import { __iconNode as GripVertical } from 'lucide-react/dist/esm/icons/grip-vertical.js';
import { __iconNode as Laptop } from 'lucide-react/dist/esm/icons/laptop.js';
import { __iconNode as List } from 'lucide-react/dist/esm/icons/list.js';
import { __iconNode as ListTodo } from 'lucide-react/dist/esm/icons/list-todo.js';
import { __iconNode as MessageCirclePlus } from 'lucide-react/dist/esm/icons/message-circle-plus.js';
import { __iconNode as MessageSquareShare } from 'lucide-react/dist/esm/icons/message-square-share.js';
import { __iconNode as Mic } from 'lucide-react/dist/esm/icons/mic.js';
import { __iconNode as Plus } from 'lucide-react/dist/esm/icons/plus.js';
import { __iconNode as ShieldCheck } from 'lucide-react/dist/esm/icons/shield-check.js';
import { __iconNode as Sparkles } from 'lucide-react/dist/esm/icons/sparkles.js';
import { __iconNode as Terminal } from 'lucide-react/dist/esm/icons/terminal.js';
import { __iconNode as X } from 'lucide-react/dist/esm/icons/x.js';

type IconNode = readonly (readonly [string, Record<string, string>])[];

const ICONS: Readonly<Record<string, IconNode>> = {
  ArrowRight, ArrowUp, AudioLines, Bell, Captions, Check, Cpu, Gauge, RefreshCw, Settings, ChevronDown, CircleX, Clock, Download, Film, Folder, GripVertical, Laptop,
  ListView: List, ListTodo, MessageCirclePlus, Mic, Plus, SecurityCheck: ShieldCheck, SideChat: MessageSquareShare,
  Sparkles, Terminal, X,
};

export function Icon(props: { name: string } & JSX.SvgSVGAttributes<SVGSVGElement>) {
  const [own, rest] = splitProps(props, ['name']);
  const node = () => ICONS[own.name] ?? [];
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...rest}>
    <For each={node()}>{([tag, attrs]) => {
      const { key: _key, ...rest } = attrs;
      return <Dynamic component={tag} {...rest} />;
    }}</For>
  </svg>;
}
