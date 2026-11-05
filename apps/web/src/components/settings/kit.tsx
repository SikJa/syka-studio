/**
 * Settings pieces with the markup of Syka Code's `settings-kit.tsx` (Syka 2.0's
 * `SykaSettingsPrimitives`), so `syka-code-settings.css` paints them the same:
 * - group: `section.syka-settings-group` with its heading and the
 *   `.syka-settings-card`;
 * - row: `.syka-settings-row` with `.syka-settings-label` (title and grey line)
 *   and `.syka-settings-control` on the right;
 * - switch: `button.syka-settings-switch` with its `span.z-switch-thumb`;
 * - dropdowns and buttons: `.syka-settings-select` and `.syka-settings-action`.
 */
import { For, Show, splitProps, type JSX, type ParentProps } from 'solid-js';
import { DropdownMenu as MenuPrimitive } from '@kobalte/core/dropdown-menu';

const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export function SettingsIntro(props: ParentProps) {
  return <p class="syka-settings-page-description">{props.children}</p>;
}

export function SettingsGroup(props: ParentProps<{ title?: JSX.Element; description?: JSX.Element; action?: JSX.Element; footnote?: JSX.Element; plain?: boolean }>) {
  return <section class="syka-settings-group" aria-label={typeof props.title === 'string' ? props.title : undefined}>
    <Show when={props.title !== undefined || props.action !== undefined}>
      <div class="syka-settings-group-heading">
        <div class="min-w-0">
          <Show when={props.title !== undefined}><h2>{props.title}</h2></Show>
          <Show when={props.description !== undefined}><p class="syka-settings-description">{props.description}</p></Show>
        </div>
        <Show when={props.action !== undefined}><div class="syka-settings-group-action flex items-center gap-1.5">{props.action}</div></Show>
      </div>
    </Show>
    {props.plain ? props.children : <div class="syka-settings-card">{props.children}</div>}
    <Show when={props.footnote !== undefined}><p class="syka-settings-message flex gap-1.5 px-4"><span>{props.footnote}</span></p></Show>
  </section>;
}

export function SettingsRow(props: ParentProps<{ icon?: JSX.Element; title: JSX.Element; description?: JSX.Element; class?: string; below?: boolean }>) {
  return <div class={cn('syka-settings-row', props.below && 'syka-settings-row-below', props.class)}>
    <Show when={props.icon !== undefined}><div class="syka-settings-leading items-center text-[var(--z-muted)] [&>svg]:size-[18px]">{props.icon}</div></Show>
    <div class="syka-settings-label">
      <span>{props.title}</span>
      <Show when={props.description !== undefined}><p>{props.description}</p></Show>
    </div>
    <Show when={props.children !== undefined}><div class="syka-settings-control">{props.children}</div></Show>
  </div>;
}

/** Syka's switch (36 × 22, white thumb that stretches while pressed). */
export function SettingsSwitch(props: { checked: boolean; onChange: (checked: boolean) => void; label?: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={props.checked} aria-label={props.label} disabled={props.disabled}
    data-state={props.checked ? 'checked' : 'unchecked'} class="syka-settings-switch" onClick={() => props.onChange(!props.checked)}>
    <span class="z-switch-thumb" aria-hidden="true" />
  </button>;
}

/** Syka's range: the bar with its progress and the value beside it. */
export function SettingsRange(props: { label?: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; format?: (value: number) => string; disabled?: boolean }) {
  const min = () => props.min ?? 0, max = () => props.max ?? 100;
  const progress = () => max() > min() ? (props.value - min()) / (max() - min()) : 0;
  return <div class="syka-range-control">
    <input aria-label={props.label} type="range" min={min()} max={max()} step={props.step ?? 1} value={props.value} disabled={props.disabled}
      style={{ '--syka-range-progress': String(Math.max(0, Math.min(1, progress()))) }} onInput={event => props.onChange(Number(event.currentTarget.value))} />
    <output>{(props.format ?? (value => `${Math.round(value)}%`))(props.value)}</output>
  </div>;
}

export type SettingsButtonTone = 'solid' | 'filled' | 'quiet' | 'danger';
export function SettingsButton(props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: SettingsButtonTone }) {
  const [own, rest] = splitProps(props, ['tone', 'class']);
  return <button type="button" {...rest} class={cn('syka-settings-action', own.class)} data-zeron-tone={own.tone ?? 'filled'} />;
}

/** Syka's dropdown: `.syka-settings-select` with the value and its arrow, and a `.syka-settings-menu` with a tick on the chosen option. */
export function SettingsSelect<T extends string>(props: { label: string; value: T; options: readonly { value: T; label: JSX.Element; disabled?: boolean }[]; onChange: (value: T) => void; disabled?: boolean }) {
  const selected = () => props.options.find(option => option.value === props.value);
  return <MenuPrimitive gutter={6} placement="bottom-end">
    <MenuPrimitive.Trigger class="syka-settings-select inline-flex items-center justify-between gap-3" aria-label={props.label} disabled={props.disabled}>
      <span class="truncate">{selected()?.label ?? props.value}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" class="size-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    </MenuPrimitive.Trigger>
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content class="syka-settings-menu z-[120] outline-none">
        <For each={props.options}>{option =>
          <MenuPrimitive.Item class="cursor-default outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            data-selected={option.value === props.value} disabled={option.disabled} onSelect={() => props.onChange(option.value)}>
            <span class="min-w-0 flex-1">{option.label}</span>
            <span class="z-select-check" aria-hidden="true">
              <Show when={option.value === props.value}><svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></Show>
            </span>
          </MenuPrimitive.Item>}
        </For>
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  </MenuPrimitive>;
}
