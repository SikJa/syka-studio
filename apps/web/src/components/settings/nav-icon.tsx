/** The settings sidebar icons: Syka Code's lucide icons, drawn in Solid from lucide's icon data. */
import { For } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { __iconNode as Activity } from 'lucide-react/dist/esm/icons/activity.js';
import { __iconNode as AudioLines } from 'lucide-react/dist/esm/icons/audio-lines.js';
import { __iconNode as Bell } from 'lucide-react/dist/esm/icons/bell.js';
import { __iconNode as Blocks } from 'lucide-react/dist/esm/icons/blocks.js';
import { __iconNode as BookA } from 'lucide-react/dist/esm/icons/book-a.js';
import { __iconNode as HardDrive } from 'lucide-react/dist/esm/icons/hard-drive.js';
import { __iconNode as Info } from 'lucide-react/dist/esm/icons/info.js';
import { __iconNode as Keyboard } from 'lucide-react/dist/esm/icons/keyboard.js';
import { __iconNode as MessageSquare } from 'lucide-react/dist/esm/icons/message-square.js';
import { __iconNode as Mic } from 'lucide-react/dist/esm/icons/mic.js';
import { __iconNode as Palette } from 'lucide-react/dist/esm/icons/palette.js';
import { __iconNode as Plug } from 'lucide-react/dist/esm/icons/plug.js';
import { __iconNode as Send } from 'lucide-react/dist/esm/icons/send.js';
import { __iconNode as SlidersHorizontal } from 'lucide-react/dist/esm/icons/sliders-horizontal.js';
import { __iconNode as SwatchBook } from 'lucide-react/dist/esm/icons/swatch-book.js';
import { __iconNode as UserRound } from 'lucide-react/dist/esm/icons/user-round.js';
import { __iconNode as UsersRound } from 'lucide-react/dist/esm/icons/users-round.js';
import { __iconNode as Waypoints } from 'lucide-react/dist/esm/icons/waypoints.js';
import { __iconNode as Wrench } from 'lucide-react/dist/esm/icons/wrench.js';
import type { SettingsPage } from './state';

type IconNode = readonly (readonly [string, Record<string, string>])[];

const ICONS: Partial<Record<SettingsPage, IconNode>> = {
  general: SlidersHorizontal, profile: UserRound, appearance: Palette, chat: MessageSquare, voice: Mic, shortcuts: Keyboard,
  notifications: Bell, codex: UsersRound, providers: Waypoints, groq: AudioLines, plugins: Plug, skills: Blocks, tools: Wrench,
  'brand-kit': SwatchBook, glossary: BookA, zernio: Send, storage: HardDrive, diagnostics: Activity, help: Info,
};

export function SettingsNavIcon(props: { page: SettingsPage }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <For each={ICONS[props.page] ?? []}>{([tag, attrs]) => {
      const { key: _key, ...rest } = attrs;
      return <Dynamic component={tag} {...rest} />;
    }}</For>
  </svg>;
}
