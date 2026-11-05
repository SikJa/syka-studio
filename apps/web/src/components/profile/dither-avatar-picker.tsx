/**
 * Settings › Perfil › Avatar, Syka Code's `DitherAvatarPicker` in Solid: every
 * change is saved at once, and without a photo the profile picture follows it.
 * With a photo, «Usar en vez de la foto» removes the photo.
 */
import { createSignal, For, Show, type JSX } from 'solid-js';
import { BLOOMS, DITHER_COLOR_NAMES, FILL_VARIANTS, cssColor, type Bloom, type FillVariant } from '@/lib/dither';
import { SettingsButton, SettingsGroup, SettingsRow, SettingsSelect, SettingsSwitch } from '@/components/settings/kit';
import { Avatar, type AvatarStatus } from './dither-avatar';
import { ditherProfile, saveDitherProfile, type DitherProfile } from './dither-profile';
import { ColorPicker } from '@/components/dashboard/personalization/color-picker';
import { Popover, PopoverContent, PopoverPortal, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import '@/components/dashboard/personalization/personalization.css';

const FACES = ['Ada Lovelace', 'grace@navy.mil', 'Linus', 'deploy-bot', 'Margaret Hamilton', 'team-design', 'Alan Turing', 'katherine.j', 'Edsger', 'ci-runner', 'Barbara Liskov', 'Ken T.', 'radia@perlman.net', 'Hopper'] as const;
const STATUSES = ['none', 'online', 'away', 'busy', 'offline'] as const;
const SHAPES = ['circle', 'square'] as const;
type Status = (typeof STATUSES)[number];
type Shape = (typeof SHAPES)[number];

const FILL_NAMES: Record<string, string> = { gradient: 'Degradado', dotted: 'Puntos', hatched: 'Rayas', solid: 'Sólido' };
const SHAPE_NAMES: Record<string, string> = { circle: 'Círculo', square: 'Cuadrado' };
const STATUS_NAMES: Record<string, string> = { none: 'Ninguno', online: 'En línea', away: 'Ausente', busy: 'Ocupado', offline: 'Desconectado' };
const BLOOM_NAMES: Record<string, string> = { off: 'No', low: 'Suave', high: 'Fuerte' };

type Choice = { name: string; fill: FillVariant; color: string | null; status: Status; shape: Shape; bloom: Bloom; ring: boolean };

function pick<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.find(option => option === value) ?? fallback;
}

export function fromSaved(saved: DitherProfile | null, userName: string): Choice {
  return {
    name: typeof saved?.['name'] === 'string' ? saved['name'] : userName,
    fill: pick(saved?.['fill'], FILL_VARIANTS, 'gradient'),
    color: saved?.['from-name'] === false && typeof saved['color'] === 'string' ? saved['color'] : null,
    status: pick(saved?.['status'], STATUSES, 'none'),
    shape: pick(saved?.['shape'], SHAPES, 'circle'),
    bloom: pick(saved?.['bloom'], BLOOMS, 'off'),
    ring: saved?.['ring'] === true,
  };
}

export function avatarProps(choice: Choice): { fill: FillVariant; shape: Shape; bloom: Bloom; ring: boolean; color?: string; status?: AvatarStatus } {
  return {
    fill: choice.fill, shape: choice.shape, bloom: choice.bloom, ring: choice.ring,
    ...(choice.color === null ? {} : { color: choice.color }),
    ...(choice.status === 'none' ? {} : { status: choice.status }),
  };
}

function toSaved(choice: Choice): DitherProfile {
  return { name: choice.name, fill: choice.fill, 'from-name': choice.color === null, color: choice.color ?? '', status: choice.status, shape: choice.shape, bloom: choice.bloom, ring: choice.ring };
}

/** Short options side by side, with the settings row control. */
function Segmented<T extends string>(props: { label: string; value: T; options: readonly T[]; names: Record<string, string>; onChange: (value: T) => void }) {
  return <div role="radiogroup" aria-label={props.label} class="syka-avatar-segmented">
    <For each={props.options}>{option =>
      <button type="button" role="radio" aria-checked={option === props.value} onClick={() => props.onChange(option)}>{props.names[option] ?? option}</button>}
    </For>
  </div>;
}

function Swatch(props: { label: string; selected: boolean; onClick: () => void; style: JSX.CSSProperties }) {
  return <button type="button" role="radio" aria-checked={props.selected} aria-label={props.label} title={props.label}
    class="syka-avatar-swatch" style={props.style} onClick={() => props.onClick()} />;
}

/** Any colour: the app's own colour picker (Apariencia › Color de acento), in the same popover. */
function CustomColor(props: { value: string; selected: boolean; onChange: (color: string) => void }) {
  const [open, setOpen] = createSignal(false);
  const [draft, setDraft] = createSignal(props.value);
  const [valid, setValid] = createSignal(true);
  return <Popover modal open={open()} onOpenChange={next => { if (next) setDraft(props.value); setOpen(next); }} placement="bottom-end" gutter={8} flip slide overlap fitViewport overflowPadding={12}>
    {/* The rainbow swatch opens the app's colour picker; chosen, it shows that colour in its centre. */}
    <PopoverTrigger class="syka-avatar-swatch syka-avatar-rainbow" role="radio" aria-label="Elegir otro color" aria-checked={props.selected} title="Elegir otro color"
      style={{ background: 'conic-gradient(from 90deg, var(--dither-color-blue), var(--dither-color-purple), var(--dither-color-pink), var(--dither-color-red), var(--dither-color-orange), var(--dither-color-green), var(--dither-color-blue))' }}>
      <Show when={props.selected}><i style={{ background: props.value }} /></Show>
    </PopoverTrigger>
    <PopoverPortal><PopoverContent class="syka-color-popover">
      <p class="syka-color-title">Color del avatar</p>
      <ColorPicker value={draft()} onChange={setDraft} onValidityChange={setValid} />
      <div class="syka-color-footer">
        <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button disabled={!valid()} onClick={() => { props.onChange(draft()); setOpen(false); }}>Usar color</Button>
      </div>
    </PopoverContent></PopoverPortal>
  </Popover>;
}

export function DitherAvatarPicker(props: { userName: string; hasPhoto: boolean; onUse: () => void }) {
  const [choice, setChoice] = createSignal<Choice>(fromSaved(ditherProfile(), props.userName));
  const set = (patch: Partial<Choice>) => {
    const next = { ...choice(), ...patch };
    setChoice(next);
    saveDitherProfile(toSaved(next));
  };
  const faces = () => [...new Set([props.userName, ...FACES])];
  const custom = () => { const color = choice().color; return color !== null && !(DITHER_COLOR_NAMES as readonly string[]).includes(color); };

  return <SettingsGroup title="Avatar" description="Sin foto, tu perfil usa este avatar de dithercn: elegí la cara y cómo se ve.">
    <div class="flex items-center gap-4 px-4 py-3">
      <Avatar name={choice().name} size={56} {...avatarProps(choice())} />
      <div role="radiogroup" aria-label="Caras" class="flex min-w-0 flex-wrap gap-1.5">
        <For each={faces().slice(0, 10)}>{face =>
          <button type="button" role="radio" aria-checked={face === choice().name} aria-label={face} title={face}
            class="syka-avatar-face" onClick={() => set({ name: face })}>
            <Avatar name={face} size={28} fill={choice().fill} shape={choice().shape} {...(choice().color === null ? {} : { color: choice().color! })} />
          </button>}
        </For>
      </div>
    </div>
    <SettingsRow title="Cara" description="Sale de este nombre: el mismo nombre da siempre la misma cara.">
      <SettingsSelect label="Cara" value={choice().name} options={faces().map(face => ({ value: face, label: face }))} onChange={name => set({ name })} />
    </SettingsRow>
    <SettingsRow title="Color">
      <div class="flex flex-wrap items-center justify-end gap-3">
        <div role="radiogroup" aria-label="Color" class="flex flex-wrap items-center gap-1.5">
            <For each={DITHER_COLOR_NAMES}>{name =>
            <Swatch label={name} selected={choice().color === name} onClick={() => set({ color: name })} style={{ background: cssColor(name) }} />}
          </For>
        </div>
        <CustomColor value={custom() && choice().color!.startsWith('#') ? choice().color! : '#7c5cf0'} selected={custom()} onChange={color => set({ color })} />
      </div>
    </SettingsRow>
    <SettingsRow title="Relleno"><Segmented label="Relleno" value={choice().fill} options={FILL_VARIANTS} names={FILL_NAMES} onChange={fill => set({ fill })} /></SettingsRow>
    <SettingsRow title="Forma"><Segmented label="Forma" value={choice().shape} options={SHAPES} names={SHAPE_NAMES} onChange={shape => set({ shape })} /></SettingsRow>
    <SettingsRow title="Estado">
      <SettingsSelect label="Estado" value={choice().status} options={STATUSES.map(status => ({ value: status, label: STATUS_NAMES[status] }))} onChange={status => set({ status })} />
    </SettingsRow>
    <SettingsRow title="Brillo"><Segmented label="Brillo" value={choice().bloom} options={BLOOMS} names={BLOOM_NAMES} onChange={bloom => set({ bloom })} /></SettingsRow>
    <SettingsRow title="Anillo" description="Un borde del color del avatar.">
      <SettingsSwitch label="Anillo" checked={choice().ring} onChange={ring => set({ ring })} />
    </SettingsRow>
    <Show when={ditherProfile() !== null || props.hasPhoto}>
      <div class="flex items-center justify-end gap-2 px-4 pt-1 pb-3">
        <Show when={ditherProfile() !== null}>
          <SettingsButton tone="quiet" onClick={() => { saveDitherProfile(null); setChoice(fromSaved(null, props.userName)); }}>Volver al de mi nombre</SettingsButton>
        </Show>
        <Show when={props.hasPhoto}>
          <SettingsButton onClick={() => { saveDitherProfile(toSaved(choice())); props.onUse(); }}>Usar en vez de la foto</SettingsButton>
        </Show>
      </div>
    </Show>
  </SettingsGroup>;
}

/** The profile picture where there is no photo: the chosen dithercn avatar, or the one of the name. */
export function ProfileAvatar(props: { name: string; size: number }) {
  const choice = () => fromSaved(ditherProfile(), props.name);
  return <Avatar name={choice().name} label={props.name} size={props.size} {...avatarProps(choice())} />;
}
